#!/usr/bin/env node
/** Refresh only repository-derived fields in the hand-authored lock checkpoint. */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { computeCandidateIdentity } from "./compute-candidate-identity.mjs";

const LOCK_FACTS_PATH = "docs/architecture/program-lock-facts.json";
const CONTENT_MANIFEST_PATH = "contracts/SHA256SUMS.json";
const CAPABILITY_MANIFEST_PATH = "capability-manifest.yaml";
const CHANGES_PATH = "openspec/changes";
const PIN_ENTRY_SHA256 =
	"09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600";
const AUTHORITY_NOTICE =
	"Pi-local input; does not modify or promote the program master";

function fail(message) {
	throw new Error(message);
}

function objectAt(value, label) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		fail(`${label} must be an object`);
	}
	return value;
}

function parseJson(bytes, label) {
	try {
		return objectAt(JSON.parse(bytes), label);
	} catch (error) {
		fail(`${label} is malformed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function canonicalRoot(cwd) {
	const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd,
		encoding: "utf8",
	});
	if (result.status !== 0) fail("current directory is not a Git repository");
	const topLevel = realpathSync(result.stdout.trim());
	if (resolve(cwd) !== topLevel || realpathSync(cwd) !== topLevel) {
		fail("command must run at the canonical Git top-level");
	}
	return topLevel;
}

function confinedPath(root, path, expectedKind) {
	let current = root;
	for (const segment of path.split("/")) {
		current = join(current, segment);
		let stat;
		try {
			stat = lstatSync(current);
		} catch {
			fail(`missing referenced ${expectedKind}: ${path}`);
		}
		if (stat.isSymbolicLink()) fail(`referenced path must not contain a symlink: ${path}`);
	}
	const stat = statSync(current);
	if (expectedKind === "file" ? !stat.isFile() : !stat.isDirectory()) {
		fail(`referenced path is not a ${expectedKind}: ${path}`);
	}
	if (realpathSync(current) !== current) fail(`referenced path escapes repository: ${path}`);
	return current;
}

function readRequiredFile(root, path) {
	return readFileSync(confinedPath(root, path, "file"), "utf8");
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function gitHead(cwd) {
	const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
	const head = result.stdout.trim();
	if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(head)) {
		fail("cannot derive a full lowercase HEAD SHA");
	}
	return head;
}

function validatePreservedFields(facts) {
	if (facts.schemaVersion !== "drenyra.program-lock-facts.v1") fail("schemaVersion mismatch");
	if (facts.participantCheckpoint !== true) fail("participantCheckpoint mismatch");
	if (facts.authorityNotice !== AUTHORITY_NOTICE) fail("authorityNotice mismatch");
	if (facts.checksums?.pinEntrySha256 !== PIN_ENTRY_SHA256) {
		fail("pinEntrySha256 does not match the package trust anchor");
	}
	if (facts.checksums?.contentManifest?.path !== CONTENT_MANIFEST_PATH) {
		fail(`contentManifest.path must be ${CONTENT_MANIFEST_PATH}`);
	}
	if (facts.capabilityStates?.manifest !== CAPABILITY_MANIFEST_PATH) {
		fail(`capabilityStates.manifest must be ${CAPABILITY_MANIFEST_PATH}`);
	}
	if (facts.capabilityStates?.schemaVersion !== "drenyra.capability-manifest.v1") {
		fail("capabilityStates.schemaVersion mismatch");
	}
	objectAt(facts.contracts, "contracts");
	objectAt(facts.tests, "tests");
	if (typeof facts.evidenceDate !== "string" || !Array.isArray(facts.derivationCommands)) {
		fail("historical evidence fields are malformed");
	}
}

export function deriveProgramLockFacts(cwd) {
	const root = canonicalRoot(cwd);
	const currentBytes = readRequiredFile(root, LOCK_FACTS_PATH);
	const facts = parseJson(currentBytes, LOCK_FACTS_PATH);
	validatePreservedFields(facts);

	const packageJson = parseJson(readRequiredFile(root, "package.json"), "package.json");
	if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
		fail("package.json version must be a non-empty string");
	}
	const contentBytes = readRequiredFile(root, CONTENT_MANIFEST_PATH);
	parseJson(contentBytes, CONTENT_MANIFEST_PATH);
	const capabilityBytes = readRequiredFile(root, CAPABILITY_MANIFEST_PATH);
	const capability = parseJson(capabilityBytes, CAPABILITY_MANIFEST_PATH);
	if (capability.schemaVersion !== facts.capabilityStates.schemaVersion) {
		fail("capability manifest schemaVersion mismatch");
	}

	const changesDirectory = confinedPath(root, CHANGES_PATH, "directory");
	const entries = readdirSync(changesDirectory, { withFileTypes: true });
	const activeChanges = entries
		.filter((entry) => entry.name !== "archive" && entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const prospective = {
		...facts,
		headSha: gitHead(root),
		packageVersion: packageJson.version,
		checksums: {
			...facts.checksums,
			contentManifest: {
				path: CONTENT_MANIFEST_PATH,
				sha256: sha256(contentBytes),
			},
		},
		capabilityStates: {
			manifest: CAPABILITY_MANIFEST_PATH,
			schemaVersion: facts.capabilityStates.schemaVersion,
			digestSha256: sha256(capabilityBytes),
		},
		activeChanges,
	};
	const preIdentityBytes = `${JSON.stringify(prospective, null, 2)}\n`;
	const { identity } = computeCandidateIdentity({ cwd: root, lockFactsBytes: preIdentityBytes });
	prospective.candidateIdentity = identity;
	return { currentBytes, finalBytes: `${JSON.stringify(prospective, null, 2)}\n` };
}

export function writeProgramLockFacts({
	cwd,
	currentBytes,
	finalBytes,
	rename = renameSync,
}) {
	const root = canonicalRoot(cwd);
	const destination = confinedPath(root, LOCK_FACTS_PATH, "file");
	if (readFileSync(destination, "utf8") !== currentBytes) {
		fail("program lock facts changed during refresh");
	}
	const temporary = `${destination}.tmp-${process.pid}`;
	let created = false;
	try {
		writeFileSync(temporary, finalBytes, {
			flag: "wx",
			mode: statSync(destination).mode,
		});
		created = true;
		rename(temporary, destination);
	} finally {
		if (created && existsSync(temporary)) unlinkSync(temporary);
	}
}

function main() {
	const args = process.argv.slice(2);
	if (args.length > 1 || (args[0] !== undefined && args[0] !== "--check" && args[0] !== "--write")) {
		fail("usage: refresh-program-lock-facts.mjs [--check|--write]");
	}
	const cwd = process.cwd();
	const { currentBytes, finalBytes } = deriveProgramLockFacts(cwd);
	if (args[0] === "--check") {
		if (currentBytes !== finalBytes) fail("program lock facts are stale; run bun run refresh:lock-facts");
		console.log("program lock facts are current");
		return;
	}
	if (currentBytes === finalBytes) {
		console.log("program lock facts are current");
		return;
	}
	writeProgramLockFacts({ cwd, currentBytes, finalBytes });
	console.log("refreshed docs/architecture/program-lock-facts.json");
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
	try {
		main();
	} catch (error) {
		console.error(`refresh-program-lock-facts: FAILED: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
}
