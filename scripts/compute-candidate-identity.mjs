#!/usr/bin/env node
/**
 * compute-candidate-identity.mjs — deterministic dirty-candidate identity (D4/§7).
 *
 * Prints one line `dirty-sha256:<64 lowercase hex>` that identifies the exact
 * uncommitted final candidate over the immutable §13 apply-whitelist path set
 * plus the planning inputs (proposal.md, design.md), relative to HEAD
 * (`c354274...` at this baseline). Exits non-zero if Git/HEAD cannot be read,
 * an allowlisted path cannot be classified, normalization fails, or no
 * allowlisted candidate change exists.
 *
 * Canonical algorithm (design §7.2):
 *   1. `git rev-parse HEAD` → full 40 lowercase hex.
 *   2. Immutable lexicographically-sorted PARTICIPATION_PATHS_V1.
 *   3. Classify changed entries A (new) / M (modified) / D (deleted), staged +
 *      unstaged; working-tree bytes hashed; deleted digest is "-".
 *   4. Git mode 100644/100755 from HEAD for tracked entries, executable bit for
 *      new entries, HEAD mode for deletions.
 *   5. Normalize self-references only: lock-facts `candidateIdentity`,
 *      `current_test_state.candidate_identity` in openspec/config.yaml, and
 *      values after the literal label `Candidate identity:` in apply-progress.md.
 *   6. Lowercase sha-256 per normalized byte sequence.
 *   7. UTF-8 canonical manifest with literal NUL separators, entries sorted by
 *      path.
 *   8. sha-256 of the manifest, prefixed `dirty-sha256:`.
 *
 * The script is read-only. Both apply and verify invoke exactly:
 *   node scripts/compute-candidate-identity.mjs
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CANDIDATE_FORMAT = "drenyra.pi.participation.v1";
export const CANDIDATE_IDENTITY_PLACEHOLDER = "__CANDIDATE_IDENTITY__";

/**
 * Design §13 apply whitelist plus the immutable planning inputs, in immutable
 * lexicographic (byte) order. Change-proof: any new apply-owned path must be
 * added here before it can participate in the candidate identity.
 */
export const PARTICIPATION_PATHS_V1 = [
	"ROADMAP.md",
	"__tests__/capability-manifest.test.ts",
	"__tests__/lock-facts.test.ts",
	"__tests__/release-verify-workflow.test.ts",
	"capability-manifest.yaml",
	"contracts/README.md",
	"contracts/SHA256SUMS.json",
	"contracts/package-contract.md",
	"contracts/runtime-dependency.md",
	"docs/architecture/program-lock-facts.json",
	"openspec/changes/pi-sdd-010-participation/apply-progress.md",
	"openspec/changes/pi-sdd-010-participation/design.md",
	"openspec/changes/pi-sdd-010-participation/proposal.md",
	"openspec/changes/pi-sdd-010-participation/spec.md",
	"openspec/changes/pi-sdd-010-participation/specs/README.md",
	"openspec/changes/pi-sdd-010-participation/specs/participation/spec.md",
	"openspec/changes/pi-sdd-010-participation/tasks.md",
	"openspec/config.yaml",
	"package.json",
	"scripts/compute-candidate-identity.mjs",
	"scripts/verify-capability-manifest.mjs",
];

function sha256Hex(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

/** Compact JSON with recursively lexicographically sorted object keys. */
function canonicalStringify(value) {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalStringify).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const keys = Object.keys(value).sort();
		return `{${keys
			.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/** Normalize the lock-facts `candidateIdentity` field (D4). */
export function normalizeLockFacts(bytes) {
	let data;
	try {
		data = JSON.parse(bytes);
	} catch (error) {
		throw new Error(
			`lock-facts normalization failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (typeof data === "object" && data !== null) {
		data.candidateIdentity = CANDIDATE_IDENTITY_PLACEHOLDER;
	}
	return `${canonicalStringify(data)}\n`;
}

/** Normalize only the `current_test_state.candidate_identity` scalar (D4). */
export function normalizeConfigYaml(bytes) {
	return bytes.replace(
		/^(\s*candidate_identity:\s*).*$/gm,
		`$1${CANDIDATE_IDENTITY_PLACEHOLDER}`,
	);
}

/** Normalize only values after the literal label `Candidate identity:` (D4). */
export function normalizeApplyProgress(bytes) {
	return bytes
		.split("\n")
		.map((line) => {
			const label = "Candidate identity:";
			const idx = line.indexOf(label);
			if (idx === -1) return line;
			return line.slice(0, idx + label.length) + CANDIDATE_IDENTITY_PLACEHOLDER;
		})
		.join("\n");
}

function normalizeBytesFor(path, bytes) {
	if (path === "docs/architecture/program-lock-facts.json") {
		return normalizeLockFacts(bytes);
	}
	if (path === "openspec/config.yaml") {
		return normalizeConfigYaml(bytes);
	}
	if (path === "openspec/changes/pi-sdd-010-participation/apply-progress.md") {
		return normalizeApplyProgress(bytes);
	}
	return bytes;
}

/**
 * Build the NUL-separated canonical manifest (design §7.2 step 7). Entries are
 * expected to be sorted by path; the digest is computed over the exact bytes.
 */
export function buildCanonicalManifest({ head, entries }) {
	const lines = [`candidate-format\0${CANDIDATE_FORMAT}`, `head\0${head}`];
	for (const entry of entries) {
		lines.push(
			`path\0${entry.path}\0state\0${entry.state}\0mode\0${entry.mode}\0sha256\0${entry.sha256}`,
		);
	}
	return `${lines.join("\n")}\n`;
}

function gitSpawn(cwd, args) {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (result.error) {
		throw new Error(`git ${args.join(" ")}: ${result.error.message}`);
	}
	return result;
}

function headHasBlob(cwd, path) {
	const result = spawnSync("git", ["cat-file", "-e", `HEAD:${path}`], {
		cwd,
		encoding: "utf8",
	});
	return result.status === 0;
}

function headModeFor(cwd, path) {
	const result = gitSpawn(cwd, ["ls-tree", "HEAD", "--", path]);
	const line = result.stdout.split("\n").find((l) => l.includes(`\t${path}`));
	if (!line) {
		throw new Error(`cannot classify allowlisted path (no HEAD entry): ${path}`);
	}
	const mode = line.split(/\s+/)[0];
	if (mode !== "100644" && mode !== "100755") {
		throw new Error(
			`cannot classify allowlisted path (unexpected mode ${mode}): ${path}`,
		);
	}
	return mode;
}

function workingTreeChanged(cwd, path) {
	const result = spawnSync("git", ["diff", "--quiet", "HEAD", "--", path], {
		cwd,
		encoding: "utf8",
	});
	if (result.error) {
		throw new Error(`git diff --quiet HEAD -- ${path}: ${result.error.message}`);
	}
	if (result.status === 0) return false;
	if (result.status === 1) return true;
	throw new Error(
		`cannot classify allowlisted path (git diff status ${result.status}): ${path}`,
	);
}

function isExecutable(fullPath) {
	try {
		return (statSync(fullPath).mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

/**
 * Compute the dirty-candidate identity for the repository at `cwd`.
 * Returns `{ identity, head, entries }` where entries are the sorted changed
 * allowlisted paths with their state/mode/sha256.
 */
export function computeCandidateIdentity({ cwd = process.cwd() } = {}) {
	const headResult = gitSpawn(cwd, ["rev-parse", "HEAD"]);
	const head = headResult.stdout.trim();
	if (!/^[0-9a-f]{40}$/.test(head)) {
		throw new Error(`unreadable HEAD: expected 40 lowercase hex, got "${head}"`);
	}

	const entries = [];
	for (const path of PARTICIPATION_PATHS_V1) {
		const fullPath = join(cwd, path);
		const hasHead = headHasBlob(cwd, path);
		const exists = existsSync(fullPath);

		if (!hasHead && !exists) continue;

		let state;
		let mode;
		let digest;
		if (!hasHead && exists) {
			state = "A";
			mode = isExecutable(fullPath) ? "100755" : "100644";
			digest = sha256Hex(normalizeBytesFor(path, readFileSync(fullPath, "utf8")));
		} else if (hasHead && !exists) {
			state = "D";
			mode = headModeFor(cwd, path);
			digest = "-";
		} else {
			if (!workingTreeChanged(cwd, path)) continue;
			state = "M";
			mode = headModeFor(cwd, path);
			digest = sha256Hex(normalizeBytesFor(path, readFileSync(fullPath, "utf8")));
		}
		entries.push({ path, state, mode, sha256: digest });
	}

	if (entries.length === 0) {
		throw new Error("no allowlisted candidate change exists");
	}

	const sorted = [...entries].sort((a, b) =>
		a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
	);
	const manifest = buildCanonicalManifest({ head, entries: sorted });
	return {
		identity: `dirty-sha256:${sha256Hex(manifest)}`,
		head,
		entries: sorted,
	};
}

function main() {
	try {
		const { identity } = computeCandidateIdentity();
		console.log(identity);
	} catch (error) {
		console.error(
			`compute-candidate-identity: FAILED: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
	main();
}
