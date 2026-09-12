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
 * When the manifest declares additive `currentProjection.surfaces`, each declared
 * repository-relative surface (matrix, README, ROADMAP) is read read-only and its
 * `<!-- conformance:<kind> ... -->` markers are validated against the manifest in
 * sorted surface order: current snapshot facts must agree with
 * `evidenceSnapshot`, historical values must be labeled and sourced, capability
 * state/verification/ownership must agree, and kernel or referenced-only
 * ownership must not be escalated to `pi-local` or to an operational end-to-end
 * claim. No network, secret, or fiscal authority is ever read.
 *
 * It also validates the two declared snapshot evidence records
 * (`openspec/config.yaml` and the generated
 * `docs/architecture/program-lock-facts.json`) against the manifest: each record
 * must be complete (command, complete result, date, identity, classification) and
 * carry an explicit `current`/`historical`/`generated` scope label with a source
 * whenever it is not current. The canonical current snapshot is published in
 * `openspec/config.yaml#/current_test_state`; the live generated candidate
 * identity is read from the lock facts, never recomputed or rewritable here. A
 * record that presents a differing value as current fails verification. The
 * records are read by fixed repository-relative path, so deleting the manifest's
 * declaration cannot skip the check.
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
const END_TO_END_LEVEL = "validated-end-to-end";
const PI_LOCAL_OWNERSHIP = "pi-local";
const AUTHORITY_VALUE = "pi-operates-never-authorizes";
const SNAPSHOT_SCOPES = new Set(["current", "historical"]);
const VERIFICATION_LEVELS = new Set([
	"declared-only",
	"implemented",
	"unit-or-contract-tested",
	END_TO_END_LEVEL,
]);
const OWNERSHIP_VALUES = new Set([
	PI_LOCAL_OWNERSHIP,
	"kernel-consumed",
	"referenced-only",
	"unavailable-operational-integration",
]);
const AUTHORITY_VALUES = new Set([AUTHORITY_VALUE]);
const SNAPSHOT_CLASSIFICATIONS = new Set(["baseline", "dirty-candidate"]);
const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIRTY_IDENTITY_RE = /^dirty-sha256:[a-f0-9]{64}$/;
const BASELINE_IDENTITY_RE = /^git-sha256:[a-f0-9]{7,64}$/;

/** Canonical snapshot-evidence vocabulary (PR 3; REQ-CONF-003 / REQ-CONF-004). */
const CONFIG_RECORD_REL = "openspec/config.yaml";
const LOCK_FACTS_RECORD_REL = "docs/architecture/program-lock-facts.json";
const CURRENT_SNAPSHOT_LOCATOR = "openspec/config.yaml#/current_test_state";
const LIVE_IDENTITY_REF =
	"docs/architecture/program-lock-facts.json#/candidateIdentity";
const EVIDENCE_RECORD_PATHS = [CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL];
const EVIDENCE_SCOPES = new Set(["current", "historical", "generated"]);
const CONFIG_SNAPSHOT_FIELDS = [
	"command",
	"files",
	"tests",
	"passing",
	"failed",
	"classification",
	"evidence_scope",
	"candidate_identity",
	"evidence_date",
];
const RESULT_COUNTS_RE = /^(\d+)\s+passed,\s*(\d+)\s+failed$/i;
/** Complete-result fields shared by every snapshot record, mapped to the canonical record. */
const CURRENT_RESULT_FIELDS = [
	["command", "command"],
	["files", "files"],
	["total", "tests"],
	["failed", "failed"],
];

let manifestLabel = "capability-manifest.yaml";
let liveCandidateIdentity = null;

const violations = [];

/** Canonical cross-surface projection marker vocabulary (PR 2). */
const PROJECTION_MARKER_PREFIX = "conformance:";
const PROJECTION_MARKER_LINE_RE =
	/^<!--\s*conformance:([a-z-]+)\s+(.*?)\s*-->$/;
const PROJECTION_FIELD_RE = /([a-z][a-z0-9-]*)=(?:"([^"]*)"|(\S+))/g;
const PROJECTION_MARKER_KINDS = new Set(["surface", "snapshot", "capability"]);
const CURRENT_SNAPSHOT_FIELDS = [
	["command", "command"],
	["result", "result"],
	["date", "date"],
	["classification", "classification"],
	["identity", "candidateIdentity"],
];
const NON_LOCAL_OWNERSHIP = new Set(
	[...OWNERSHIP_VALUES].filter((value) => value !== PI_LOCAL_OWNERSHIP),
);
const FORBIDDEN_AUTHORITY_PHRASES = [
	"pi authorizes fiscal operations",
	"pi grants fiscal authority",
	"pi owns the dominion program",
	"pi delivers sdd-0",
	"drenyra pi owns the master",
];

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

function hasRecordedRuntimeQualification(evidence) {
	const qualification = evidence.runtimeQualification;
	return (
		typeof qualification === "object" &&
		qualification !== null &&
		(qualification.kind === "installed-package" ||
			qualification.kind === "runtime") &&
		typeof qualification.command === "string" &&
		qualification.command.trim().length > 0 &&
		typeof qualification.result === "string" &&
		qualification.result.trim().length > 0
	);
}

function validateCapabilityEvidenceMetadata(name, entry, evidence) {
	if (typeof entry.verificationLevel !== "string") {
		violation(`missing verificationLevel for ${name}`);
	} else if (!VERIFICATION_LEVELS.has(entry.verificationLevel)) {
		violation(
			`unsupported verificationLevel for ${name}: ${entry.verificationLevel}`,
		);
	}
	if (
		typeof entry.ownership !== "string" ||
		!OWNERSHIP_VALUES.has(entry.ownership)
	) {
		violation(`unsupported ownership for ${name}: ${String(entry.ownership)}`);
	}
	if (
		typeof entry.authority !== "string" ||
		!AUTHORITY_VALUES.has(entry.authority)
	) {
		violation(`unsupported authority for ${name}: ${String(entry.authority)}`);
	}
	if (
		entry.verificationLevel === END_TO_END_LEVEL &&
		!hasRecordedRuntimeQualification(evidence)
	) {
		violation(
			`validated-end-to-end for ${name} requires recorded installed-package or runtime evidence`,
		);
	}
}

function isCalendarDate(value) {
	if (!CALENDAR_DATE_RE.test(value)) return false;
	const [year, month, day] = value.split("-").map(Number);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return (
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day
	);
}

function relativeLabel(root, absPath) {
	const rel = relative(root, absPath).replace(/\\/g, "/");
	if (rel.length === 0 || rel.startsWith("..") || isAbsolute(rel))
		return absPath;
	return rel;
}

/** One flat `key: value` scalar, quoted values unquoted, booleans/ints typed. */
function scalarValue(raw) {
	const quoted = /^"(.*)"$/.exec(raw) ?? /^'(.*)'$/.exec(raw);
	const value = quoted === null ? raw : quoted[1];
	if (value === "true") return true;
	if (value === "false") return false;
	if (/^\d+$/.test(value)) return Number(value);
	return value;
}

/**
 * Flat single-level reader for the one non-JSON evidence surface. Only the block's
 * own scalar `key: value` lines are read; deeper block-scalar prose and nested
 * structures are ignored, so the guard stays dependency-free and deterministic.
 * Returns `null` when the block header is absent.
 */
function readFlatRecord(text, header) {
	const lines = text.split("\n");
	const headerIndex = lines.findIndex((line) => line.trimEnd() === `${header}:`);
	if (headerIndex === -1) return null;
	const fields = {};
	let blockIndent;
	for (let i = headerIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim().length === 0) continue;
		const indent = line.length - line.trimStart().length;
		if (indent === 0) break;
		const match = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line.trim());
		if (blockIndent === undefined) {
			if (match === null) continue;
			blockIndent = indent;
		}
		if (indent !== blockIndent || match === null) continue;
		const raw = match[2].trim();
		if (raw.length === 0 || raw.startsWith(">") || raw.startsWith("|")) continue;
		fields[match[1]] = scalarValue(raw);
	}
	return fields;
}

function completeResult(total, failed) {
	return `${total - failed} passed, ${failed} failed`;
}

/** Comparable form of a `N passed, M failed` result statement. */
function normalizeResult(value) {
	const match = RESULT_COUNTS_RE.exec(String(value ?? ""));
	if (match === null)
		return String(value ?? "")
			.trim()
			.toLowerCase();
	return `${Number(match[1])} passed, ${Number(match[2])} failed`;
}

function isIdentityForClassification(value, classification) {
	const pattern =
		classification === "baseline" ? BASELINE_IDENTITY_RE : DIRTY_IDENTITY_RE;
	return typeof value === "string" && pattern.test(value);
}

/** Every complete current result must match the canonical current snapshot. */
function compareCurrentResult(rel, record, canonical) {
	for (const [field, canonicalField] of CURRENT_RESULT_FIELDS) {
		if (record[field] !== canonical[canonicalField]) {
			violation(
				`conflicting current snapshot ${field} in ${rel}: ${String(record[field])} != ${String(canonical[canonicalField])}`,
			);
		}
	}
}

/**
 * A snapshot record is either `current`, or explicitly labeled `historical` or
 * `generated` with a source; every other state is an unlabeled snapshot claim.
 */
function validateEvidenceScope(rel, label, scope, source) {
	if (!EVIDENCE_SCOPES.has(scope)) {
		violation(`missing evidence scope label for ${label} in ${rel}`);
		return null;
	}
	if (
		scope !== "current" &&
		(typeof source !== "string" || source.trim().length === 0)
	) {
		violation(`unlabeled ${scope} snapshot in ${rel}: ${label}`);
	}
	return scope;
}

function readEvidenceText(root, rel) {
	const abs = resolve(root, rel);
	if (!existsSync(abs) || !statSync(abs).isFile()) {
		violation(`missing evidence record file: ${rel}`);
		return null;
	}
	return readFileSync(abs, "utf8");
}

function readEvidenceJson(root, rel) {
	const text = readEvidenceText(root, rel);
	if (text === null) return null;
	try {
		return JSON.parse(text);
	} catch (error) {
		violation(`unreadable evidence record: ${rel} (${error.message})`);
		return null;
	}
}

function readLiveCandidateIdentity(lockFacts) {
	if (
		typeof lockFacts !== "object" ||
		lockFacts === null ||
		Array.isArray(lockFacts)
	) {
		return null;
	}
	const identity = lockFacts.candidateIdentity;
	if (typeof identity !== "string" || !DIRTY_IDENTITY_RE.test(identity)) {
		violation(
			`live candidate identity in ${LOCK_FACTS_RECORD_REL} must be a dirty-sha256 identity`,
		);
		return null;
	}
	return identity;
}

function validateEvidenceSnapshot(snapshot) {
	if (
		typeof snapshot !== "object" ||
		snapshot === null ||
		Array.isArray(snapshot)
	) {
		violation("missing required evidenceSnapshot object");
		return;
	}
	if (snapshot.scope !== "point-in-time") {
		violation('evidenceSnapshot scope must be "point-in-time"');
	}
	const label = `${manifestLabel}#evidenceSnapshot`;
	const scope = validateEvidenceScope(
		manifestLabel,
		"evidenceSnapshot",
		snapshot.evidenceScope,
		snapshot.evidenceSource,
	);
	if (!SNAPSHOT_CLASSIFICATIONS.has(snapshot.classification)) {
		violation(
			"evidenceSnapshot classification must be baseline or dirty-candidate",
		);
	}
	for (const field of ["command", "result"]) {
		if (
			typeof snapshot[field] !== "string" ||
			snapshot[field].trim().length === 0
		) {
			violation(`evidenceSnapshot ${field} must be a non-empty string`);
		}
	}
	if (typeof snapshot.date !== "string" || !isCalendarDate(snapshot.date)) {
		violation("evidenceSnapshot date must be an ISO-8601 calendar date");
	}
	const required =
		snapshot.classification === "baseline" ? "git-sha256" : "dirty-sha256";
	const identityPattern =
		snapshot.classification === "baseline"
			? BASELINE_IDENTITY_RE
			: DIRTY_IDENTITY_RE;
	// A surface whose bytes participate in the candidate identity cannot record the
	// live identity literally without invalidating it, so a current record may
	// delegate to the generated identity instead of restating it. The delegated
	// reference is closed vocabulary: no other path is ever read.
	if (snapshot.candidateIdentity === undefined) {
		if (snapshot.candidateIdentityRef !== LIVE_IDENTITY_REF) {
			violation(
				`evidenceSnapshot candidateIdentity must be a ${required} identity`,
			);
		} else if (
			liveCandidateIdentity === null ||
			!identityPattern.test(liveCandidateIdentity)
		) {
			violation(
				`evidenceSnapshot candidateIdentityRef must resolve to a ${required} identity`,
			);
		}
	} else if (
		typeof snapshot.candidateIdentity !== "string" ||
		!identityPattern.test(snapshot.candidateIdentity)
	) {
		violation(
			`evidenceSnapshot candidateIdentity must be a ${required} identity`,
		);
	} else if (
		scope === "current" &&
		liveCandidateIdentity !== null &&
		snapshot.candidateIdentity !== liveCandidateIdentity
	) {
		violation(
			`conflicting current snapshot identity in ${label}: ${snapshot.candidateIdentity} != ${liveCandidateIdentity}`,
		);
	}
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

	validateCapabilityEvidenceMetadata(name, entry, evidence);

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

function projectionFields(kind, body) {
	const fields = {};
	let consumed = "";
	PROJECTION_FIELD_RE.lastIndex = 0;
	let field;
	while ((field = PROJECTION_FIELD_RE.exec(body)) !== null) {
		if (fields[field[1]] !== undefined) {
			return { error: `duplicate projection field: ${field[1]}` };
		}
		fields[field[1]] = field[2] ?? field[3];
		consumed += `${consumed ? " " : ""}${field[0]}`;
	}
	if (consumed !== body.replace(/\s+/g, " ").trim()) {
		return { error: "malformed projection marker fields" };
	}
	return { kind, fields };
}

function readProjectionMarkers(rel, text) {
	const markers = [];
	for (const line of text.split("\n")) {
		if (!line.includes(PROJECTION_MARKER_PREFIX)) continue;
		const match = PROJECTION_MARKER_LINE_RE.exec(line.trim());
		if (!match) {
			violation(`malformed projection marker in ${rel}`);
			continue;
		}
		const parsed = projectionFields(match[1], match[2]);
		if (parsed.error) {
			violation(`${parsed.error} in ${rel}`);
			continue;
		}
		markers.push(parsed);
	}
	return markers;
}

function hasSourceLink(marker) {
	return (
		typeof marker.fields.source === "string" && marker.fields.source.length > 0
	);
}

function validateSurfaceMarker(rel, marker) {
	if (typeof marker.fields.id !== "string" || marker.fields.id.length === 0) {
		violation(`missing projection surface id in ${rel}`);
	}
	if ((marker.fields.authority ?? "").toLowerCase() !== AUTHORITY_VALUE) {
		violation(`missing authority boundary marker in ${rel}`);
	}
	if (!hasSourceLink(marker)) {
		violation(`missing source link for conformance:surface in ${rel}`);
	}
}

function snapshotExpectedValue(snapshot, manifestKey) {
	const value = snapshot[manifestKey];
	if (
		manifestKey === "candidateIdentity" &&
		typeof value !== "string" &&
		snapshot.candidateIdentityRef === LIVE_IDENTITY_REF &&
		liveCandidateIdentity !== null
	) {
		return liveCandidateIdentity;
	}
	return value;
}

function validateSnapshotMarker(data, rel, marker) {
	const scope = (marker.fields.scope ?? "").toLowerCase();
	if (!SNAPSHOT_SCOPES.has(scope)) {
		violation(`missing snapshot classification in ${rel}`);
		return;
	}
	if (!hasSourceLink(marker)) {
		violation(
			scope === "historical"
				? `unlabeled historical snapshot in ${rel}`
				: `missing source link for conformance:snapshot in ${rel}`,
		);
		return;
	}
	if (scope === "historical") return;
	const snapshot = data.evidenceSnapshot ?? {};
	for (const [field, manifestKey] of CURRENT_SNAPSHOT_FIELDS) {
		const claimed = marker.fields[field];
		if (claimed === undefined) continue;
		const expected = String(snapshotExpectedValue(snapshot, manifestKey));
		if (claimed.toLowerCase() !== expected.toLowerCase()) {
			violation(
				`conflicting current snapshot ${field} in ${rel}: ${claimed} != ${expected}`,
			);
		}
	}
}

function validateCapabilityMarker(data, rel, marker) {
	const name = marker.fields.name;
	const capabilities = data.capabilities ?? {};
	if (typeof name !== "string" || !(name in capabilities)) {
		violation(`unknown projection capability in ${rel}: ${String(name)}`);
		return;
	}
	if (!hasSourceLink(marker)) {
		violation(`missing source link for conformance:capability in ${rel}`);
	}
	const entry = capabilities[name];
	const expectedVerification = entry.verificationLevel;
	const expectedOwnership = entry.ownership;
	const claimedVerification = (marker.fields.verification ?? "").toLowerCase();
	const claimedOwnership = (marker.fields.ownership ?? "").toLowerCase();
	const claimedState = (marker.fields.state ?? "").toLowerCase();
	if (claimedVerification === END_TO_END_LEVEL) {
		if (expectedVerification !== END_TO_END_LEVEL) {
			violation(`unsupported operational end-to-end claim for ${name} in ${rel}`);
		}
	} else if (
		claimedVerification.length > 0 &&
		claimedVerification !== String(expectedVerification).toLowerCase()
	) {
		violation(
			`conflicting verification level for ${name} in ${rel}: ${claimedVerification} != ${String(expectedVerification)}`,
		);
	}
	if (
		claimedOwnership.length > 0 &&
		claimedOwnership !== String(expectedOwnership).toLowerCase()
	) {
		violation(
			`conflicting ownership for ${name} in ${rel}: ${claimedOwnership} != ${String(expectedOwnership)}`,
		);
	}
	if (
		claimedState.length > 0 &&
		claimedState !== String(entry.state).toLowerCase()
	) {
		violation(
			`conflicting capability state for ${name} in ${rel}: ${claimedState} != ${String(entry.state)}`,
		);
	}
	if (
		NON_LOCAL_OWNERSHIP.has(String(expectedOwnership)) &&
		claimedOwnership === PI_LOCAL_OWNERSHIP
	) {
		violation(
			`ownership escalation for ${name} in ${rel}: pi-local claim over ${String(expectedOwnership)}`,
		);
	}
	if (
		(marker.fields.operational ?? "").toLowerCase() === "end-to-end" &&
		expectedVerification !== END_TO_END_LEVEL
	) {
		violation(`unsupported operational end-to-end claim for ${name} in ${rel}`);
	}
}

function validateProjectionSurface(data, root, rel) {
	const abs = resolve(root, rel);
	if (!existsSync(abs) || !statSync(abs).isFile()) {
		violation(`missing projection surface: ${rel}`);
		return;
	}
	const text = readFileSync(abs, "utf8");
	const markers = readProjectionMarkers(rel, text);
	for (const marker of markers) {
		if (!PROJECTION_MARKER_KINDS.has(marker.kind)) {
			violation(
				`unsupported projection marker in ${rel}: conformance:${marker.kind}`,
			);
		}
	}
	const surfaceMarkers = markers.filter((m) => m.kind === "surface");
	if (surfaceMarkers.length === 0) {
		violation(`missing surface marker in ${rel}`);
	} else if (surfaceMarkers.length > 1) {
		violation(`duplicate surface marker in ${rel}`);
	} else {
		validateSurfaceMarker(rel, surfaceMarkers[0]);
	}
	const snapshotMarkers = markers.filter((m) => m.kind === "snapshot");
	if (snapshotMarkers.length === 0) {
		violation(`missing snapshot marker in ${rel}`);
	}
	for (const marker of snapshotMarkers) {
		validateSnapshotMarker(data, rel, marker);
	}
	for (const marker of markers.filter((m) => m.kind === "capability")) {
		validateCapabilityMarker(data, rel, marker);
	}
	const normalized = text.replace(/\s+/g, " ").toLowerCase();
	for (const phrase of FORBIDDEN_AUTHORITY_PHRASES) {
		if (normalized.includes(phrase)) {
			violation(`forbidden authority claim in ${rel}: ${phrase}`);
		}
	}
}

/**
 * Cross-surface projection check (PR 2). Surfaces are validated in sorted order
 * so diagnostics never depend on declaration order. The manifest declares its
 * surfaces additively; when `currentProjection` is absent there is nothing to
 * project, and the real repository pins the declaration in its focused tests.
 */
function validateProjection(data, root) {
	const projection = data.currentProjection;
	if (projection === undefined) return;
	if (
		typeof projection !== "object" ||
		projection === null ||
		Array.isArray(projection)
	) {
		violation("currentProjection must be an object");
		return;
	}
	const surfaces = projection.surfaces;
	if (!Array.isArray(surfaces) || surfaces.length === 0) {
		violation("currentProjection surfaces must be a non-empty array");
		return;
	}
	for (const rel of surfaces) {
		if (
			typeof rel !== "string" ||
			rel.length === 0 ||
			isAbsolute(rel) ||
			rel.includes("..")
		) {
			violation(`invalid projection surface path: ${String(rel)}`);
		}
	}
	const sorted = surfaces
		.filter(
			(rel) =>
				typeof rel === "string" &&
				rel.length > 0 &&
				!isAbsolute(rel) &&
				!rel.includes(".."),
		)
		.sort();
	for (const rel of sorted) {
		validateProjectionSurface(data, root, rel);
	}
}

/**
 * Canonical current snapshot (PR 3). `openspec/config.yaml#/current_test_state` is
 * the only surface that can publish the live candidate identity, because its
 * `candidate_identity` line is identity-normalized. When it presents itself as
 * current it must be complete and must agree with the manifest's current snapshot
 * record and with the generated live identity.
 */
function validateCurrentSnapshotRecord(root, data) {
	const text = readEvidenceText(root, CONFIG_RECORD_REL);
	if (text === null) return null;
	const fields = readFlatRecord(text, "current_test_state");
	if (fields === null) {
		violation(
			`missing current snapshot record in ${CONFIG_RECORD_REL}: current_test_state`,
		);
		return null;
	}
	for (const field of CONFIG_SNAPSHOT_FIELDS) {
		if (fields[field] === undefined) {
			violation(
				`missing current snapshot field in ${CONFIG_RECORD_REL}: ${field}`,
			);
		}
	}
	if (!Number.isInteger(fields.files) || fields.files < 1) {
		violation(
			`current snapshot files in ${CONFIG_RECORD_REL} must be a positive integer`,
		);
	}
	if (!Number.isInteger(fields.tests) || fields.tests < 1) {
		violation(
			`current snapshot tests in ${CONFIG_RECORD_REL} must be a positive integer`,
		);
	}
	if (!Number.isInteger(fields.failed) || fields.failed < 0) {
		violation(
			`current snapshot failed in ${CONFIG_RECORD_REL} must be a non-negative integer`,
		);
	}
	if (typeof fields.passing !== "boolean") {
		violation(
			`current snapshot passing in ${CONFIG_RECORD_REL} must be a boolean`,
		);
	} else if (fields.passing !== (fields.failed === 0)) {
		violation(
			`current snapshot result in ${CONFIG_RECORD_REL} must state passing exactly when failed = 0`,
		);
	}
	if (typeof fields.command !== "string" || fields.command.trim().length === 0) {
		violation(
			`current snapshot command in ${CONFIG_RECORD_REL} must be a non-empty string`,
		);
	}
	if (
		typeof fields.evidence_date !== "string" ||
		!isCalendarDate(fields.evidence_date)
	) {
		violation(
			`current snapshot evidence_date in ${CONFIG_RECORD_REL} must be an ISO-8601 calendar date`,
		);
	}
	if (!SNAPSHOT_CLASSIFICATIONS.has(fields.classification)) {
		violation(
			`current snapshot classification in ${CONFIG_RECORD_REL} must be baseline or dirty-candidate`,
		);
	} else if (
		!isIdentityForClassification(fields.candidate_identity, fields.classification)
	) {
		violation(
			`current snapshot candidate_identity in ${CONFIG_RECORD_REL} must be a ${
				fields.classification === "baseline" ? "git-sha256" : "dirty-sha256"
			} identity`,
		);
	}
	const scope = validateEvidenceScope(
		CONFIG_RECORD_REL,
		"current_test_state",
		fields.evidence_scope,
		fields.evidence_source,
	);
	if (scope !== "current") return fields;
	// A retained non-current manifest snapshot is a legitimate baseline beside the
	// current candidate; agreement is required only when both claim to be current.
	const snapshot = data.evidenceSnapshot ?? {};
	if (snapshot.evidenceScope !== "current") return fields;
	if (fields.command !== snapshot.command) {
		violation(
			`conflicting current snapshot command in ${CONFIG_RECORD_REL}: ${String(fields.command)} != ${String(snapshot.command)}`,
		);
	}
	if (fields.evidence_date !== snapshot.date) {
		violation(
			`conflicting current snapshot date in ${CONFIG_RECORD_REL}: ${String(fields.evidence_date)} != ${String(snapshot.date)}`,
		);
	}
	if (fields.classification !== snapshot.classification) {
		violation(
			`conflicting current snapshot classification in ${CONFIG_RECORD_REL}: ${String(fields.classification)} != ${String(snapshot.classification)}`,
		);
	}
	if (Number.isInteger(fields.tests) && Number.isInteger(fields.failed)) {
		const derived = completeResult(fields.tests, fields.failed);
		if (normalizeResult(derived) !== normalizeResult(snapshot.result)) {
			violation(
				`conflicting current snapshot result in ${CONFIG_RECORD_REL}: ${derived} != ${String(snapshot.result)}`,
			);
		}
	}
	if (
		liveCandidateIdentity !== null &&
		fields.candidate_identity !== liveCandidateIdentity
	) {
		violation(
			`conflicting current snapshot identity in ${CONFIG_RECORD_REL}: ${String(fields.candidate_identity)} != ${liveCandidateIdentity}`,
		);
	}
	return fields;
}

/**
 * Generated lock facts stay generated/locked evidence. Their preserved test
 * counts are legitimate only while they carry an explicit non-current scope label
 * and a source; a lock fact that claims `current` must match the canonical
 * snapshot exactly.
 */
function validateLockFactsRecord(lockFacts, canonical) {
	if (lockFacts === null) return;
	const record = lockFacts.snapshotRecord;
	if (
		typeof lockFacts !== "object" ||
		Array.isArray(lockFacts) ||
		typeof record !== "object" ||
		record === null ||
		Array.isArray(record)
	) {
		violation(`missing snapshot record label in ${LOCK_FACTS_RECORD_REL}`);
		return;
	}
	const scope = validateEvidenceScope(
		LOCK_FACTS_RECORD_REL,
		"snapshotRecord",
		record.evidenceScope,
		record.evidenceSource,
	);
	if (scope !== "current") return;
	if (canonical === null || canonical.evidence_scope !== "current") return;
	const tests =
		typeof lockFacts.tests === "object" && lockFacts.tests !== null
			? lockFacts.tests
			: {};
	compareCurrentResult(LOCK_FACTS_RECORD_REL, tests, canonical);
	if (lockFacts.evidenceDate !== canonical.evidence_date) {
		violation(
			`conflicting current snapshot evidenceDate in ${LOCK_FACTS_RECORD_REL}: ${String(lockFacts.evidenceDate)} != ${String(canonical.evidence_date)}`,
		);
	}
}

/** The manifest's embedded test state must agree with the current snapshot. */
function validateTestStateRecord(data, canonical) {
	const ts = data.testState;
	if (typeof ts !== "object" || ts === null) return;
	const scope = validateEvidenceScope(
		manifestLabel,
		"testState",
		ts.evidenceScope,
		ts.evidenceSource,
	);
	if (scope !== "current") return;
	if (canonical === null || canonical.evidence_scope !== "current") return;
	compareCurrentResult(`${manifestLabel}#testState`, ts, canonical);
}

/**
 * Snapshot evidence records (PR 3). The declaration is required, and both records
 * are read by fixed repository-relative path regardless of the declaration, so a
 * manifest that drops the declaration cannot skip the check.
 */
function validateEvidenceRecords(data, root, lockFacts) {
	const projection = data.currentProjection;
	if (projection === undefined) {
		violation("missing currentProjection declaration");
	}
	const declared =
		typeof projection === "object" && projection !== null
			? projection.evidenceRecords
			: undefined;
	if (!Array.isArray(declared) || declared.length === 0) {
		violation("currentProjection evidenceRecords must be a non-empty array");
	} else {
		for (const rel of declared) {
			if (typeof rel !== "string" || !EVIDENCE_RECORD_PATHS.includes(rel)) {
				violation(`unknown evidence record: ${String(rel)}`);
			}
		}
		for (const rel of EVIDENCE_RECORD_PATHS) {
			if (!declared.includes(rel)) violation(`missing evidence record: ${rel}`);
		}
	}
	const locator =
		typeof projection === "object" && projection !== null
			? projection.currentSnapshot
			: undefined;
	if (locator !== CURRENT_SNAPSHOT_LOCATOR) {
		violation(
			`currentProjection currentSnapshot must be "${CURRENT_SNAPSHOT_LOCATOR}"`,
		);
	}
	const canonical = validateCurrentSnapshotRecord(root, data);
	validateLockFactsRecord(lockFacts, canonical);
	validateTestStateRecord(data, canonical);
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
		const capabilityNames = Object.keys(caps).sort();
		for (const name of capabilityNames) {
			if (!MASTER_CAPABILITIES.includes(name)) {
				violation(`unknown capability: ${name}`);
			}
		}
		for (const name of MASTER_CAPABILITIES) {
			if (!(name in caps)) {
				violation(`missing capability: ${name}`);
			}
		}
		for (const name of capabilityNames) {
			validateCapabilityEntry(name, caps[name], root);
		}
	}

	const lockFacts = readEvidenceJson(root, LOCK_FACTS_RECORD_REL);
	liveCandidateIdentity = readLiveCandidateIdentity(lockFacts);

	validateEvidenceSnapshot(data.evidenceSnapshot);

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

	validateEvidenceRecords(data, root, lockFacts);
	validateProjection(data, root);
}
const parsed = parseArgs(process.argv.slice(2));
if (parsed.error) usageExit(parsed.error);
if (!existsSync(parsed.root) || !statSync(parsed.root).isDirectory()) {
	usageExit(`root is not a readable directory: ${parsed.root}`);
}
manifestLabel = relativeLabel(parsed.root, parsed.manifestPath);

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
