#!/usr/bin/env node
/**
 * verify-capability-manifest.mjs — read-only capability checkpoint validator.
 *
 * Validates the repository-root `capability-manifest.yaml` (JSON-compatible YAML
 * 1.2 profile) against schema `drenyra.capability-manifest.v1` (design §5.2)
 * and the master Pi capability names (REQ-CAP-001..004). Zero runtime
 * dependencies; parses deterministically with JSON.parse.
 *
 * Usage:
 *   node scripts/verify-capability-manifest.mjs
 *   node scripts/verify-capability-manifest.mjs --manifest <path> --root <path>
 *
 * Exit codes:
 *   0 — valid manifest; prints `verify-capability-manifest: OK`
 *   1 — syntax/schema/semantic inconsistency; prints
 *       `verify-capability-manifest: FAILED` + one line per violation
 *   2 — invalid CLI usage or unreadable requested file/root
 *
 * The validator is read-only: it never writes either repository.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const SCHEMA_VERSION = "drenyra.capability-manifest.v1";
const EXPECTED_ROLE = "agentic-runtime";
const EXPECTED_COMMAND = "bun test";
const EXPECTED_EVIDENCE_REF =
	"docs/architecture/program-lock-facts.json#/tests";
const MASTER_CAPABILITIES = [
	"persona-startup-panel",
	"drenyra-commands",
	"pi-subagents",
	"model-routing",
	"packaged-skills",
	"rda-chains",
	"tool-safety-broad-deny",
	"engram-integration",
	"pinned-ai-runtime",
	"configurator-install-doctor-sync",
];
const STATES = new Set(["implemented", "partial", "planned"]);
const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const violations = [];

function violation(message) {
	violations.push(message);
}

function parseArgs(argv) {
	let manifestPath;
	let root = REPO_ROOT;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--manifest") {
			const value = argv[++i];
			if (value === undefined) return { error: "--manifest requires a path" };
			manifestPath = value;
		} else if (arg === "--root") {
			const value = argv[++i];
			if (value === undefined) return { error: "--root requires a path" };
			root = value;
		} else {
			return { error: `unknown flag: ${arg}` };
		}
	}
	if (!manifestPath) manifestPath = join(root, "capability-manifest.yaml");
	return { manifestPath, root };
}

function usageExit(message) {
	console.error(`verify-capability-manifest: USAGE ERROR: ${message}`);
	process.exit(2);
}

function evidencePathExists(root, rel) {
	return existsSync(resolve(root, rel));
}

function validateCapabilityEntry(name, entry, root) {
	if (typeof entry !== "object" || entry === null) {
		violation(`capability ${name}: missing capability entry object`);
		return;
	}
	const state = entry.state;
	if (!STATES.has(state)) {
		violation(`unsupported capability state for ${name}: ${String(state)}`);
	}
	const evidence = entry.evidence;
	if (typeof evidence !== "object" || evidence === null) {
		violation(`capability ${name}: missing evidence object`);
		return;
	}
	const sources = Array.isArray(evidence.sources) ? evidence.sources : [];
	const tests = Array.isArray(evidence.tests) ? evidence.tests : [];
	const limitation = evidence.limitation;
	const plan = evidence.plan;

	for (const path of [...sources, ...tests]) {
		if (typeof path !== "string" || path.length === 0) {
			violation(`missing evidence path for ${name}: ${String(path)}`);
			continue;
		}
		if (path.includes("..") || !evidencePathExists(root, path)) {
			violation(`missing evidence path for ${name}: ${path}`);
		}
	}

	if (state === "implemented") {
		if (sources.length === 0 || tests.length === 0) {
			violation(
				`state implemented for ${name} is not backed by executable evidence`,
			);
		}
		if (typeof limitation === "string" && limitation.trim().length > 0) {
			violation(`state implemented for ${name} must not carry a limitation`);
		}
		if (typeof plan === "string" && plan.trim().length > 0) {
			violation(`state implemented for ${name} must not carry a plan`);
		}
	} else if (state === "partial") {
		if (sources.length === 0 && tests.length === 0) {
			violation(
				`state partial for ${name} is not backed by any source/test reference`,
			);
		}
		if (typeof limitation !== "string" || limitation.trim().length === 0) {
			violation(`state partial for ${name} requires a non-empty limitation`);
		}
		if (typeof plan === "string" && plan.trim().length > 0) {
			violation(`state partial for ${name} must not carry a plan`);
		}
	} else if (state === "planned") {
		if (typeof plan !== "string" || plan.trim().length === 0) {
			violation(`state planned for ${name} requires a non-empty plan`);
		}
	}
}

function validateManifest(data, root) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		violation("manifest must be a JSON object");
		return;
	}
	if (data.schemaVersion !== SCHEMA_VERSION) {
		violation(`unsupported schema version: ${String(data.schemaVersion)}`);
	}

	const repo = data.repository;
	if (typeof repo !== "object" || repo === null) {
		violation("missing required repository object");
	} else {
		for (const field of ["name", "package", "role", "version"]) {
			if (typeof repo[field] !== "string" || repo[field].length === 0) {
				violation(`missing required repository field: ${field}`);
			}
		}
		if (repo.role !== EXPECTED_ROLE) {
			violation(`missing required role: expected ${EXPECTED_ROLE}`);
		}
		const pkgPath = join(root, "package.json");
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
				if (typeof pkg.version === "string" && repo.version !== pkg.version) {
					violation(
						`repository version ${repo.version} does not match package.json version ${pkg.version}`,
					);
				}
			} catch {
				violation(`unreadable package.json at root: ${pkgPath}`);
			}
		} else {
			violation(`missing package.json at root: ${pkgPath}`);
		}
	}

	const caps = data.capabilities;
	if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
		violation("missing required capabilities object");
	} else {
		for (const name of Object.keys(caps)) {
			if (!MASTER_CAPABILITIES.includes(name)) {
				violation(`unknown capability: ${name}`);
			}
		}
		for (const name of MASTER_CAPABILITIES) {
			if (!(name in caps)) {
				violation(`missing capability: ${name}`);
			}
		}
		for (const name of Object.keys(caps)) {
			validateCapabilityEntry(name, caps[name], root);
		}
	}

	const ts = data.testState;
	if (typeof ts !== "object" || ts === null) {
		violation("missing required testState object");
	} else {
		if (ts.command !== EXPECTED_COMMAND) {
			violation(`testState command must be "${EXPECTED_COMMAND}"`);
		}
		if (ts.evidenceRef !== EXPECTED_EVIDENCE_REF) {
			violation(`testState evidenceRef must be "${EXPECTED_EVIDENCE_REF}"`);
		}
		if (ts.result !== "passing" && ts.result !== "failing") {
			violation('testState result must be "passing" or "failing"');
		}
		for (const field of ["files", "total", "passed", "failed"]) {
			if (!Number.isInteger(ts[field]) || ts[field] < 0) {
				violation(
					`testState counts are inconsistent: ${field} must be a non-negative integer`,
				);
			}
		}
		if (
			Number.isInteger(ts.passed) &&
			Number.isInteger(ts.failed) &&
			Number.isInteger(ts.total) &&
			ts.passed + ts.failed !== ts.total
		) {
			violation(
				"testState counts are inconsistent: passed + failed must equal total",
			);
		}
		if (
			ts.result === "passing" &&
			Number.isInteger(ts.failed) &&
			ts.failed !== 0
		) {
			violation(
				"testState counts are inconsistent: result passing requires failed = 0",
			);
		}
	}

	if (
		typeof data.generatedAt !== "string" ||
		!UTC_ISO_RE.test(data.generatedAt)
	) {
		violation("invalid generatedAt: not a canonical UTC ISO-8601 instant");
	}
	if (
		!Array.isArray(data.derivedFrom) ||
		data.derivedFrom.length === 0 ||
		data.derivedFrom.some((s) => typeof s !== "string" || s.length === 0)
	) {
		violation("derivedFrom must be a non-empty array of source references");
	}
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.error) usageExit(parsed.error);
if (!existsSync(parsed.root) || !statSync(parsed.root).isDirectory()) {
	usageExit(`root is not a readable directory: ${parsed.root}`);
}

let text;
try {
	text = readFileSync(parsed.manifestPath, "utf8");
} catch (error) {
	usageExit(`cannot read manifest: ${parsed.manifestPath} (${error.message})`);
}

if (!text.endsWith("\n")) {
	violation("invalid YAML/JSON serialization: missing final newline");
}
let data;
try {
	data = JSON.parse(text);
} catch (error) {
	violation(`invalid YAML/JSON serialization: ${error.message}`);
}
if (data !== undefined) {
	validateManifest(data, parsed.root);
}

if (violations.length > 0) {
	console.log("verify-capability-manifest: FAILED");
	for (const v of violations) {
		console.log(`  ${v}`);
	}
	process.exit(1);
}
console.log("verify-capability-manifest: OK");
