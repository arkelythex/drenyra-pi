/**
 * Capability manifest verification — tests for scripts/verify-capability-manifest.mjs
 * (design D2/§5.2–§5.3; REQ-CAP-001..004).
 *
 * The validator is a zero-dependency, read-only CLI. These tests spawn it against
 * deterministic temporary roots and against the real repository manifest:
 *
 *   - valid manifest passes;
 *   - unknown capability fails;
 *   - missing capability fails;
 *   - missing role fails;
 *   - invalid YAML/JSON fails;
 *   - implemented state without source/test evidence fails;
 *   - inconsistent count arithmetic fails;
 *   - unsupported state value fails;
 *   - partial without limitation fails;
 *   - planned without plan fails;
 *   - missing or path-escaping evidence path fails;
 *   - snapshot evidence records (openspec/config.yaml and the generated lock
 *     facts) are complete, labeled, and agree on the current candidate;
 *   - the real repository capability-manifest.yaml validates.
 *
 * PR 3 fixture note: every deterministic temp root now also carries an
 * `openspec/config.yaml` current snapshot record and a lock-facts record, and every
 * root manifest declares `currentProjection.evidenceRecords`/`currentSnapshot`.
 * The guard reads the two evidence records by fixed repository-relative path, so a
 * root that omits the declaration is rejected rather than skipped.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/exit codes are JSON integers, never
 * floats.
 */

import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const VALIDATOR = join(REPO_ROOT, "scripts", "verify-capability-manifest.mjs");

interface RunResult {
	code: number | null;
	stdout: string;
	stderr: string;
}

interface RuntimeQualification {
	kind: "installed-package" | "runtime";
	command: string;
	result: string;
}

interface Evidence {
	sources: string[];
	tests: string[];
	limitation?: string;
	plan?: string;
	runtimeQualification?: RuntimeQualification;
	[key: string]: unknown;
}

interface CapabilityEntry {
	state: string;
	evidence: Evidence;
	verificationLevel?: string;
	ownership?: string;
	authority?: string;
	[key: string]: unknown;
}

interface EvidenceSnapshot {
	scope?: string;
	evidenceScope?: string;
	evidenceSource?: string;
	classification?: string;
	command?: string;
	result?: string;
	date?: string;
	candidateIdentity?: string;
	candidateIdentityRef?: string;
}

interface Repository {
	name?: string;
	package?: string;
	role?: string;
	version?: string;
}

interface TestState {
	passed?: number;
	[key: string]: unknown;
}

interface Manifest {
	capabilities: Record<string, CapabilityEntry>;
	evidenceSnapshot: EvidenceSnapshot;
	repository: Repository;
	testState: TestState;
	[key: string]: unknown;
}

/** PR 3 snapshot-evidence vocabulary shared with the verifier. */
const CONFIG_RECORD_REL = "openspec/config.yaml";
const LOCK_FACTS_RECORD_REL = "docs/architecture/program-lock-facts.json";
const CURRENT_SNAPSHOT_LOCATOR = "openspec/config.yaml#/current_test_state";
const LIVE_IDENTITY_REF =
	"docs/architecture/program-lock-facts.json#/candidateIdentity";
const FIXTURE_IDENTITY = `dirty-sha256:${"a".repeat(64)}`;

async function runValidator(args: string[]): Promise<RunResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			process.execPath,
			[VALIDATOR, ...args],
			{ cwd: REPO_ROOT },
		);
		return { code: 0, stdout, stderr };
	} catch (error) {
		const e = error as {
			code?: number | string;
			stdout?: string;
			stderr?: string;
		};
		return {
			code: typeof e.code === "number" ? e.code : 1,
			stdout: e.stdout ?? "",
			stderr: e.stderr ?? "",
		};
	}
}

function tempRoot(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

/** Evidence paths shared by the deterministic roots and the real manifest. */
const DEFAULT_CAPABILITIES: Record<string, CapabilityEntry> = {
	"persona-startup-panel": {
		state: "implemented",
		evidence: {
			sources: ["extensions/startup-panel.ts"],
			tests: ["__tests__/extension.test.ts"],
		},
	},
	"drenyra-commands": {
		state: "implemented",
		evidence: {
			sources: ["extensions/register.ts"],
			tests: ["__tests__/extension.test.ts"],
		},
	},
	"pi-subagents": {
		state: "implemented",
		evidence: {
			sources: [
				"agents/accounting-scout.md",
				"agents/evidence-builder.md",
				"agents/ledger-analyst.md",
				"agents/reconciliation-agent.md",
				"agents/tax-controller-pe.md",
				"agents/anomaly-refuter.md",
				"agents/close-controller.md",
			],
			tests: ["__tests__/agents.test.ts"],
		},
	},
	"model-routing": {
		state: "partial",
		evidence: {
			sources: ["extensions/register.ts", "prompts/models.md"],
			tests: ["__tests__/extension.test.ts"],
			limitation:
				"advisory registry exists; the installed Pi host slice exposes no model-routing API (G30) and model suggestions never grant authority",
		},
	},
	"packaged-skills": {
		state: "implemented",
		evidence: {
			sources: ["skills/scope-discipline/SKILL.md"],
			tests: ["__tests__/content.test.ts"],
		},
	},
	"rda-chains": {
		state: "implemented",
		evidence: {
			sources: ["chains/monthly-close.ts"],
			tests: ["chains/__tests__/monthly-close-flow.test.ts"],
		},
	},
	"tool-safety-broad-deny": {
		state: "implemented",
		evidence: {
			sources: ["agents/accounting-scout.md"],
			tests: ["__tests__/agents.test.ts"],
		},
	},
	"engram-integration": {
		state: "partial",
		evidence: {
			sources: ["runtime/context.ts"],
			tests: ["__tests__/extension.test.ts"],
			limitation:
				"Pi reads Drenyra Engram context at the memory boundary and never authorizes operations, but no complete executable Engram integration is evidenced; context persistence is a development-grade local JSON store and canonical memory integration is a later concern (REQ-BOUND-001)",
		},
	},
	"pinned-ai-runtime": {
		state: "implemented",
		evidence: {
			sources: ["runtime/pin.ts"],
			tests: ["__tests__/pin.test.ts"],
		},
	},
	"configurator-install-doctor-sync": {
		state: "planned",
		evidence: {
			sources: ["ROADMAP.md"],
			tests: [],
			plan:
				"Master SDD-020/Gate 0 plan only; no local implementation (REQ-BOUND-001).",
		},
	},
};

function capabilitiesWithEvidenceMetadata(): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(DEFAULT_CAPABILITIES).map(([name, entry]) => [
			name,
			{
				...entry,
				verificationLevel:
					name === "configurator-install-doctor-sync"
						? "declared-only"
						: "unit-or-contract-tested",
				ownership: name === "pinned-ai-runtime" ? "kernel-consumed" : "pi-local",
				authority: "pi-operates-never-authorizes",
			},
		]),
	);
}

function writeManifest(
	root: string,
	manifest: Record<string, unknown>,
): string {
	const manifestPath = join(root, "capability-manifest.yaml");
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	return manifestPath;
}

/** Builds a temp root with package.json, stub evidence files, and a valid manifest. */
function writeValidRoot(): { root: string; manifestPath: string } {
	const root = tempRoot("pi-capability-valid-");
	writeFileSync(
		join(root, "package.json"),
		`${JSON.stringify({ name: "drenyra-shell", version: "0.0.1-prealpha.1" })}\n`,
	);
	const stubFiles: Record<string, string> = {
		"extensions/register.ts": "export const register = true;\n",
		"extensions/startup-panel.ts": "export const panel = true;\n",
		"runtime/pin.ts": "export const pin = true;\n",
		"runtime/context.ts": "export const context = true;\n",
		"agents/accounting-scout.md": "# accounting-scout\n",
		"agents/evidence-builder.md": "# evidence-builder\n",
		"agents/ledger-analyst.md": "# ledger-analyst\n",
		"agents/reconciliation-agent.md": "# reconciliation-agent\n",
		"agents/tax-controller-pe.md": "# tax-controller-pe\n",
		"agents/anomaly-refuter.md": "# anomaly-refuter\n",
		"agents/close-controller.md": "# close-controller\n",
		"skills/scope-discipline/SKILL.md": "# scope-discipline\n",
		"chains/monthly-close.ts": "export const chain = true;\n",
		"prompts/models.md": "# models\n",
		"ROADMAP.md": "# ROADMAP\n",
		"__tests__/extension.test.ts": 'import { it } from "vitest";\n',
		"__tests__/agents.test.ts": 'import { it } from "vitest";\n',
		"__tests__/pin.test.ts": 'import { it } from "vitest";\n',
		"__tests__/content.test.ts": 'import { it } from "vitest";\n',
		"chains/__tests__/monthly-close-flow.test.ts":
			'import { it } from "vitest";\n',
	};
	for (const [rel, content] of Object.entries(stubFiles)) {
		const full = join(root, rel);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, content);
	}
	const manifest = {
		schemaVersion: "drenyra.capability-manifest.v1",
		currentProjection: {
			surfaces: PROJECTION_SURFACES,
			evidenceRecords: [CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL],
			currentSnapshot: CURRENT_SNAPSHOT_LOCATOR,
		},
		repository: {
			name: "drenyra-shell",
			package: "drenyra-shell",
			role: "agentic-runtime",
			version: "0.0.1-prealpha.1",
		},
		capabilities: capabilitiesWithEvidenceMetadata(),
		evidenceSnapshot: {
			scope: "point-in-time",
			evidenceScope: "current",
			classification: "dirty-candidate",
			command: "bun test",
			result: "557 passed, 0 failed",
			date: "2026-08-14",
			candidateIdentityRef: LIVE_IDENTITY_REF,
		},
		testState: {
			command: "bun test",
			result: "passing",
			files: 35,
			total: 557,
			passed: 557,
			failed: 0,
			evidenceScope: "current",
			evidenceRef: "docs/architecture/program-lock-facts.json#/tests",
		},
		generatedAt: "2026-08-14T00:00:00.000Z",
		derivedFrom: ["arkelythex/drenyra-ai@4975f4f"],
	};
	const manifestPath = writeManifest(root, manifest);
	writeConfigRecord(root);
	writeLockFactsRecord(root);
	addProjection(root, manifestPath);
	return { root, manifestPath };
}

/**
 * Renders the OpenSpec project-context record. `undefined` omits a field so the
 * negative cases can present incomplete records; `>-` renders a block scalar as
 * scalarValue producers do.
 */
function configRecordText(
	overrides: Record<string, string | number | boolean | undefined> = {},
): string {
	const fields: Record<string, string | number | boolean | undefined> = {
		files: 35,
		tests: 557,
		passing: true,
		failed: 0,
		command: "bun test",
		classification: "dirty-candidate",
		evidence_scope: "current",
		candidate_identity: FIXTURE_IDENTITY,
		evidence_date: "2026-08-14",
		evidence: "fixture current snapshot",
		...overrides,
	};
	const lines = ["current_test_state:"];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined) continue;
		const rendered =
			typeof value === "string" ? JSON.stringify(value) : String(value);
		lines.push(`      ${key}: ${rendered}`);
	}
	return `${lines.join("\n")}\n`;
}

function writeConfigRecord(
	root: string,
	overrides: Record<string, string | number | boolean | undefined> = {},
): void {
	const target = join(root, CONFIG_RECORD_REL);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, configRecordText(overrides));
}

/** Renders the generated lock-facts evidence record. */
function lockFactsText(
	overrides: {
		identity?: string;
		evidenceDate?: string;
		tests?: Record<string, unknown>;
		snapshotRecord?: Record<string, unknown>;
	} = {},
): string {
	const facts: Record<string, unknown> = {
		schemaVersion: "drenyra.program-lock-facts.v1",
		candidateIdentity: overrides.identity ?? FIXTURE_IDENTITY,
		evidenceDate: overrides.evidenceDate ?? "2026-08-14",
		tests: {
			command: "bun test",
			files: 35,
			total: 557,
			passed: 557,
			failed: 0,
			...(overrides.tests ?? {}),
		},
		snapshotRecord: {
			evidenceScope: "historical",
			evidenceSource: "docs/architecture/program-lock-facts.md#what-changes",
			...(overrides.snapshotRecord ?? {}),
		},
	};
	if (overrides.snapshotRecord === undefined && "snapshotRecord" in overrides) {
		delete facts.snapshotRecord;
	}
	return `${JSON.stringify(facts, null, 2)}\n`;
}

function writeLockFactsRecord(
	root: string,
	overrides: Parameters<typeof lockFactsText>[0] = {},
): void {
	const target = join(root, LOCK_FACTS_RECORD_REL);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, lockFactsText(overrides));
}

function readManifest(manifestPath: string): Manifest {
	return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

function writeManifestObject(manifestPath: string, manifest: Manifest): void {
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * PR 2 cross-surface projection fixture. The three declared surfaces carry only
 * conforming markers by default: a self-identifying `surface` marker, a `current`
 * snapshot marker that delegates to the manifest, and no capability claims.
 */
const PROJECTION_SURFACES = [
	"README.md",
	"ROADMAP.md",
	"docs/architecture/capability-conformance-matrix.md",
];
const MATRIX_SURFACE = PROJECTION_SURFACES[2];
const VALID_SURFACE_MARKERS = [
	"<!-- conformance:surface id=matrix authority=pi-operates-never-authorizes source=AGENTS.md#non-negotiable-rules -->",
	"<!-- conformance:snapshot scope=current source=capability-manifest.yaml#/evidenceSnapshot -->",
];

function matrixOnly(lines: string[]): Record<string, string[]> {
	return { [MATRIX_SURFACE]: lines };
}

function addProjection(
	root: string,
	manifestPath: string,
	surfaces: Record<string, string[]> = {},
): void {
	const manifest = readManifest(manifestPath);
	manifest.currentProjection = {
		surfaces: PROJECTION_SURFACES,
		evidenceRecords: [CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL],
		currentSnapshot: CURRENT_SNAPSHOT_LOCATOR,
	};
	writeManifestObject(manifestPath, manifest);
	for (const rel of PROJECTION_SURFACES) {
		const full = join(root, rel);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(
			full,
			`${(surfaces[rel] ?? VALID_SURFACE_MARKERS).join("\n")}\n`,
		);
	}
}

describe("verify-capability-manifest.mjs (spawned CLI, deterministic temp roots)", () => {
	it("accepts a valid manifest with exit 0 and prints OK", async () => {
		const { root, manifestPath } = writeValidRoot();
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("verify-capability-manifest: OK");
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an unknown capability name", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["time-travel"] = {
			state: "implemented",
			evidence: {
				sources: ["extensions/register.ts"],
				tests: ["__tests__/extension.test.ts"],
			},
		};
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain("unknown capability: time-travel");
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects a missing master capability name", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		delete manifest.capabilities["engram-integration"];
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain("missing capability: engram-integration");
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects a missing repository role", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		delete manifest.repository.role;
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"missing required role: expected agentic-runtime",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects invalid YAML/JSON serialization", async () => {
		const { root } = writeValidRoot();
		const manifestPath = join(root, "capability-manifest.yaml");
		writeFileSync(manifestPath, "{ not valid json ]\n");
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toMatch(/invalid YAML\/JSON serialization/);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects implemented state without source/test evidence", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["drenyra-commands"].evidence.sources = [];
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"state implemented for drenyra-commands is not backed by executable evidence",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects inconsistent testState count arithmetic", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.testState.passed = 556; // 556 + 0 !== 557
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"testState counts are inconsistent: passed + failed must equal total",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an unsupported capability state value", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["pinned-ai-runtime"].state = "shipped";
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"unsupported capability state for pinned-ai-runtime: shipped",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects partial state without a limitation", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		delete manifest.capabilities["model-routing"].evidence.limitation;
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"state partial for model-routing requires a non-empty limitation",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects planned state without a plan", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		delete manifest.capabilities["configurator-install-doctor-sync"].evidence
			.plan;
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"state planned for configurator-install-doctor-sync requires a non-empty plan",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an evidence path that does not exist", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["pinned-ai-runtime"].evidence.sources = [
			"runtime/does-not-exist.ts",
		];
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"missing evidence path for pinned-ai-runtime: runtime/does-not-exist.ts",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an evidence path that escapes the root", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["pinned-ai-runtime"].evidence.sources = [
			"../outside.ts",
		];
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"missing evidence path for pinned-ai-runtime: ../outside.ts",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects missing or unknown verification levels", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		delete manifest.capabilities["drenyra-commands"].verificationLevel;
		writeManifestObject(manifestPath, manifest);
		const missing = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(missing.code).toBe(1);
		expect(missing.stdout).toContain(
			"missing verificationLevel for drenyra-commands",
		);

		manifest.capabilities["drenyra-commands"].verificationLevel = "operational";
		writeManifestObject(manifestPath, manifest);
		const unknown = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(unknown.code).toBe(1);
		expect(unknown.stdout).toContain(
			"unsupported verificationLevel for drenyra-commands: operational",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects invalid ownership and authority values", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["pinned-ai-runtime"].ownership = "operator-owned";
		manifest.capabilities["pinned-ai-runtime"].authority = "fiscal-authority";
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"unsupported ownership for pinned-ai-runtime: operator-owned",
		);
		expect(result.stdout).toContain(
			"unsupported authority for pinned-ai-runtime: fiscal-authority",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects incomplete or malformed point-in-time snapshots", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.evidenceSnapshot = {
			classification: "dirty-candidate",
			command: "bun test",
			result: "passing",
			date: "2026-08-14",
		};
		writeManifestObject(manifestPath, manifest);
		const incomplete = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(incomplete.code).toBe(1);
		expect(incomplete.stdout).toContain(
			"evidenceSnapshot candidateIdentity must be a dirty-sha256 identity",
		);

		manifest.evidenceSnapshot.candidateIdentity = "git-sha256:not-a-hash";
		manifest.evidenceSnapshot.date = "2026/08/14";
		writeManifestObject(manifestPath, manifest);
		const malformed = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(malformed.code).toBe(1);
		expect(malformed.stdout).toContain(
			"evidenceSnapshot date must be an ISO-8601 calendar date",
		);
		expect(malformed.stdout).toContain(
			"evidenceSnapshot candidateIdentity must be a dirty-sha256 identity",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects end-to-end claims without recorded runtime qualification", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["drenyra-commands"].verificationLevel =
			"validated-end-to-end";
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"validated-end-to-end for drenyra-commands requires recorded installed-package or runtime evidence",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("accepts each verification level when its recorded evidence qualifies", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		const commandCapability = manifest.capabilities["drenyra-commands"];
		for (const verificationLevel of [
			"declared-only",
			"implemented",
			"unit-or-contract-tested",
		]) {
			commandCapability.verificationLevel = verificationLevel;
			writeManifestObject(manifestPath, manifest);
			const result = await runValidator([
				"--manifest",
				manifestPath,
				"--root",
				root,
			]);
			expect(result.code).toBe(0);
		}
		commandCapability.verificationLevel = "validated-end-to-end";
		commandCapability.evidence.runtimeQualification = {
			kind: "runtime",
			command: "bun run installed-runtime-smoke",
			result: "complete invocation path passed",
		};
		writeManifestObject(manifestPath, manifest);
		const runtimeQualified = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(runtimeQualified.code).toBe(0);
		rmSync(root, { recursive: true, force: true });
	});

	it("distinguishes baseline and dirty-candidate snapshot identities", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.evidenceSnapshot.classification = "baseline";
		manifest.evidenceSnapshot.candidateIdentity = "git-sha256:1234567";
		manifest.evidenceSnapshot.candidateIdentityRef = undefined;
		manifest.evidenceSnapshot.evidenceScope = "historical";
		manifest.evidenceSnapshot.evidenceSource =
			"openspec/changes/archive/2026-08-15-pi-sdd-010-participation/verify-report.md";
		writeManifestObject(manifestPath, manifest);
		const baseline = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(baseline.code).toBe(0);

		manifest.evidenceSnapshot.classification = "dirty-candidate";
		manifest.evidenceSnapshot.candidateIdentity = FIXTURE_IDENTITY;
		manifest.evidenceSnapshot.evidenceScope = "current";
		manifest.evidenceSnapshot.evidenceSource = undefined;
		writeManifestObject(manifestPath, manifest);
		const dirtyCandidate = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(dirtyCandidate.code).toBe(0);
		rmSync(root, { recursive: true, force: true });
	});

	it("sorts multiple violations deterministically", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["time-travel-z"] = {} as CapabilityEntry;
		manifest.capabilities["time-travel-a"] = {} as CapabilityEntry;
		writeManifestObject(manifestPath, manifest);
		const first = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		const second = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(first.code).toBe(1);
		expect(second.stdout).toBe(first.stdout);
		expect(
			first.stdout.indexOf("unknown capability: time-travel-a"),
		).toBeLessThan(first.stdout.indexOf("unknown capability: time-travel-z"));
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects conflicting current snapshot metadata across manifest and matrix", async () => {
		const { root, manifestPath } = writeValidRoot();
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				VALID_SURFACE_MARKERS[0],
				'<!-- conformance:snapshot scope=current source=docs/architecture/capability-conformance-matrix.md result="9999 passed, 0 failed" date=2020-01-01 classification=baseline identity=dirty-sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc -->',
			]),
		);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`conflicting current snapshot result in ${MATRIX_SURFACE}: 9999 passed, 0 failed != 557 passed, 0 failed`,
		);
		expect(result.stdout).toContain(
			`conflicting current snapshot classification in ${MATRIX_SURFACE}: baseline != dirty-candidate`,
		);
		expect(result.stdout).toContain(
			`conflicting current snapshot date in ${MATRIX_SURFACE}: 2020-01-01 != 2026-08-14`,
		);
		expect(result.stdout).toContain(
			`conflicting current snapshot identity in ${MATRIX_SURFACE}`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an unlabeled historical count", async () => {
		const { root, manifestPath } = writeValidRoot();
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				VALID_SURFACE_MARKERS[0],
				'<!-- conformance:snapshot scope=historical result="717 passed, 0 failed" date=2026-09-09 -->',
			]),
		);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`unlabeled historical snapshot in ${MATRIX_SURFACE}`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects ownership escalation and unsupported operational end-to-end claims", async () => {
		const { root, manifestPath } = writeValidRoot();
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				...VALID_SURFACE_MARKERS,
				"<!-- conformance:capability name=pinned-ai-runtime state=implemented verification=unit-or-contract-tested ownership=pi-local source=README.md -->",
				"<!-- conformance:capability name=packaged-skills verification=validated-end-to-end source=README.md -->",
				"<!-- conformance:capability name=engram-integration operational=end-to-end source=README.md -->",
			]),
		);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`ownership escalation for pinned-ai-runtime in ${MATRIX_SURFACE}: pi-local claim over kernel-consumed`,
		);
		expect(result.stdout).toContain(
			`unsupported operational end-to-end claim for packaged-skills in ${MATRIX_SURFACE}`,
		);
		expect(result.stdout).toContain(
			`unsupported operational end-to-end claim for engram-integration in ${MATRIX_SURFACE}`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("accepts a valid all-local non-end-to-end repository projection", async () => {
		const { root, manifestPath } = writeValidRoot();
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				...VALID_SURFACE_MARKERS,
				"<!-- conformance:capability name=packaged-skills state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/packaged-skills -->",
				'<!-- conformance:snapshot scope=historical result="717 passed, 0 failed" date=2026-09-09 source=docs/architecture/capability-conformance-matrix.md -->',
			]),
		);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("verify-capability-manifest: OK");
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects unknown capabilities, unsupported markers, and authority claims", async () => {
		const { root, manifestPath } = writeValidRoot();
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				"<!-- conformance:provenance id=matrix source=README.md -->",
				"<!-- conformance:snapshot scope=current source=capability-manifest.yaml#/evidenceSnapshot -->",
				"<!-- conformance:capability name=time-travel verification=declared-only source=README.md -->",
				"Pi grants fiscal authority to every operator persona.",
				'<!-- conformance:snapshot scope=HISTORICAL result="717 passed, 0 failed" -->',
			]),
		);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`missing surface marker in ${MATRIX_SURFACE}`,
		);
		expect(result.stdout).toContain(
			`unsupported projection marker in ${MATRIX_SURFACE}: conformance:provenance`,
		);
		expect(result.stdout).toContain(
			`unknown projection capability in ${MATRIX_SURFACE}: time-travel`,
		);
		expect(result.stdout).toContain(
			`forbidden authority claim in ${MATRIX_SURFACE}: pi grants fiscal authority`,
		);
		expect(result.stdout).toContain(
			`unlabeled historical snapshot in ${MATRIX_SURFACE}`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("keeps projection diagnostics deterministic and surface-order-independent", async () => {
		const invalidMatrix = [
			VALID_SURFACE_MARKERS[0],
			VALID_SURFACE_MARKERS[1],
			"<!-- conformance:capability name=pinned-ai-runtime ownership=pi-local source=README.md -->",
			"<!-- conformance:capability name=time-travel source=README.md -->",
		];
		const divergentReadme = [
			"<!-- conformance:surface id=readme authority=fiscal-authority source=README.md -->",
		];
		const declaredOrder = writeValidRoot();
		addProjection(declaredOrder.root, declaredOrder.manifestPath, {
			[MATRIX_SURFACE]: invalidMatrix,
			"README.md": divergentReadme,
		});
		const reversed = writeValidRoot();
		addProjection(reversed.root, reversed.manifestPath, {
			[MATRIX_SURFACE]: invalidMatrix,
			"README.md": divergentReadme,
		});
		const reversedManifest = readManifest(reversed.manifestPath);
		reversedManifest.currentProjection = {
			surfaces: [...PROJECTION_SURFACES].reverse(),
			evidenceRecords: [CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL],
			currentSnapshot: CURRENT_SNAPSHOT_LOCATOR,
		};
		writeManifestObject(reversed.manifestPath, reversedManifest);
		const first = await runValidator([
			"--manifest",
			declaredOrder.manifestPath,
			"--root",
			declaredOrder.root,
		]);
		const second = await runValidator([
			"--manifest",
			reversed.manifestPath,
			"--root",
			reversed.root,
		]);
		expect(first.code).toBe(1);
		expect(second.stdout).toBe(first.stdout);
		expect(first.stdout).toContain(
			"missing authority boundary marker in README.md",
		);
		rmSync(declaredOrder.root, { recursive: true, force: true });
		rmSync(reversed.root, { recursive: true, force: true });
	});

	it("rejects escalation of referenced-only and unavailable ownership to pi-local", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.capabilities["packaged-skills"].ownership = "referenced-only";
		manifest.capabilities["engram-integration"].ownership =
			"unavailable-operational-integration";
		writeManifestObject(manifestPath, manifest);
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				...VALID_SURFACE_MARKERS,
				"<!-- conformance:capability name=packaged-skills ownership=pi-local source=capability-manifest.yaml#/capabilities/packaged-skills -->",
				"<!-- conformance:capability name=engram-integration ownership=pi-local source=capability-manifest.yaml#/capabilities/engram-integration -->",
			]),
		);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`ownership escalation for packaged-skills in ${MATRIX_SURFACE}: pi-local claim over referenced-only`,
		);
		expect(result.stdout).toContain(
			`ownership escalation for engram-integration in ${MATRIX_SURFACE}: pi-local claim over unavailable-operational-integration`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects missing surfaces, escaping surface paths, and unsourced capability claims", async () => {
		const { root, manifestPath } = writeValidRoot();
		addProjection(
			root,
			manifestPath,
			matrixOnly([
				...VALID_SURFACE_MARKERS,
				"<!-- conformance:capability name=packaged-skills state=implemented -->",
			]),
		);
		const escaping = readManifest(manifestPath);
		escaping.currentProjection = {
			surfaces: [MATRIX_SURFACE, "../outside.md"],
			evidenceRecords: [CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL],
			currentSnapshot: CURRENT_SNAPSHOT_LOCATOR,
		};
		writeManifestObject(manifestPath, escaping);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"invalid projection surface path: ../outside.md",
		);
		expect(result.stdout).toContain(
			`missing source link for conformance:capability in ${MATRIX_SURFACE}`,
		);

		const absent = readManifest(manifestPath);
		absent.currentProjection = {
			surfaces: ["docs/architecture/absent-surface.md"],
			evidenceRecords: [CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL],
			currentSnapshot: CURRENT_SNAPSHOT_LOCATOR,
		};
		writeManifestObject(manifestPath, absent);
		const missing = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(missing.code).toBe(1);
		expect(missing.stdout).toContain(
			"missing projection surface: docs/architecture/absent-surface.md",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects a manifest that omits the current-projection and evidence-record declaration", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.currentProjection = undefined;
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain("missing currentProjection declaration");
		expect(result.stdout).toContain(
			`currentProjection evidenceRecords must be a non-empty array`,
		);
		// The evidence records are read by fixed path, so deleting the declaration
		// cannot skip the snapshot check.
		expect(result.stdout).toContain(
			`currentProjection currentSnapshot must be "${CURRENT_SNAPSHOT_LOCATOR}"`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects incomplete, unlabeled, or unsourced snapshot evidence records", async () => {
		const { root, manifestPath } = writeValidRoot();
		writeConfigRecord(root, {
			classification: undefined,
			evidence_scope: undefined,
			candidate_identity: undefined,
			files: undefined,
		});
		const missingRecordLabel = writeLockFactsRecord as (
			root: string,
			overrides?: unknown,
		) => void;
		missingRecordLabel(root, { snapshotRecord: undefined });
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		for (const field of [
			"classification",
			"evidence_scope",
			"candidate_identity",
			"files",
		]) {
			expect(result.stdout).toContain(
				`missing current snapshot field in ${CONFIG_RECORD_REL}: ${field}`,
			);
		}
		expect(result.stdout).toContain(
			`missing snapshot record label in ${LOCK_FACTS_RECORD_REL}`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an unsupported evidence scope and an unlabeled non-current record", async () => {
		const { root, manifestPath } = writeValidRoot();
		writeConfigRecord(root, { evidence_scope: "evergreen" });
		writeLockFactsRecord(root, {
			snapshotRecord: { evidenceScope: "generated", evidenceSource: undefined },
		});
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`missing evidence scope label for current_test_state in ${CONFIG_RECORD_REL}`,
		);
		expect(result.stdout).toContain(
			`unlabeled generated snapshot in ${LOCK_FACTS_RECORD_REL}: snapshotRecord`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects a mismatched dirty identity, a baseline presented as current, and a stale count", async () => {
		const { root, manifestPath } = writeValidRoot();
		writeConfigRecord(root, {
			candidate_identity: `dirty-sha256:${"b".repeat(64)}`,
		});
		const mismatched = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(mismatched.code).toBe(1);
		expect(mismatched.stdout).toContain(
			`conflicting current snapshot identity in ${CONFIG_RECORD_REL}: dirty-sha256:${"b".repeat(64)} != ${FIXTURE_IDENTITY}`,
		);

		writeConfigRecord(root, {
			classification: "baseline",
			candidate_identity: "git-sha256:1234567",
		});
		const baseline = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(baseline.code).toBe(1);
		expect(baseline.stdout).toContain(
			`conflicting current snapshot identity in ${CONFIG_RECORD_REL}: git-sha256:1234567 != ${FIXTURE_IDENTITY}`,
		);
		expect(baseline.stdout).toContain(
			`conflicting current snapshot classification in ${CONFIG_RECORD_REL}: baseline != dirty-candidate`,
		);

		writeConfigRecord(root, { files: 37, tests: 582 });
		const stale = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(stale.code).toBe(1);
		expect(stale.stdout).toContain(
			`conflicting current snapshot result in ${CONFIG_RECORD_REL}: 582 passed, 0 failed != 557 passed, 0 failed`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects a lock fact that claims the current snapshot while recording different counts", async () => {
		const { root, manifestPath } = writeValidRoot();
		writeLockFactsRecord(root, {
			snapshotRecord: {
				evidenceScope: "current",
				evidenceSource: "openspec/config.yaml#/current_test_state",
			},
			tests: { files: 48, total: 738, passed: 738, failed: 0 },
			evidenceDate: "2026-09-09",
		});
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`conflicting current snapshot files in ${LOCK_FACTS_RECORD_REL}: 48 != 35`,
		);
		expect(result.stdout).toContain(
			`conflicting current snapshot total in ${LOCK_FACTS_RECORD_REL}: 738 != 557`,
		);
		expect(result.stdout).toContain(
			`conflicting current snapshot evidenceDate in ${LOCK_FACTS_RECORD_REL}: 2026-09-09 != 2026-08-14`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects an unlabeled manifest test state and a stale manifest snapshot label", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.testState.evidenceScope = undefined;
		manifest.testState.evidenceSource = undefined;
		manifest.evidenceSnapshot.evidenceScope = undefined;
		manifest.evidenceSnapshot.evidenceSource = undefined;
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"missing evidence scope label for evidenceSnapshot in capability-manifest.yaml",
		);
		expect(result.stdout).toContain(
			"missing evidence scope label for testState in capability-manifest.yaml",
		);

		// A manifest test state that claims the current snapshot must match it.
		const stale = readManifest(manifestPath);
		stale.evidenceSnapshot.evidenceScope = "current";
		stale.testState.evidenceScope = "current";
		stale.testState.total = 700;
		writeManifestObject(manifestPath, stale);
		const staleResult = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(staleResult.code).toBe(1);
		expect(staleResult.stdout).toContain(
			"conflicting current snapshot total in capability-manifest.yaml#testState: 700 != 557",
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("rejects a manifest current snapshot with a hand-edited identity that no longer matches", async () => {
		const { root, manifestPath } = writeValidRoot();
		const manifest = readManifest(manifestPath);
		manifest.evidenceSnapshot.candidateIdentity = `dirty-sha256:${"c".repeat(64)}`;
		manifest.evidenceSnapshot.candidateIdentityRef = undefined;
		writeManifestObject(manifestPath, manifest);
		const result = await runValidator([
			"--manifest",
			manifestPath,
			"--root",
			root,
		]);
		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			`conflicting current snapshot identity in capability-manifest.yaml#evidenceSnapshot: dirty-sha256:${"c".repeat(64)} != ${FIXTURE_IDENTITY}`,
		);
		rmSync(root, { recursive: true, force: true });
	});

	it("validates the real repository capability-manifest.yaml and projection surfaces", async () => {
		const declared = readManifest(join(REPO_ROOT, "capability-manifest.yaml"))
			.currentProjection as
			| {
					surfaces?: string[];
					evidenceRecords?: string[];
					currentSnapshot?: string;
			  }
			| undefined;
		expect(declared?.surfaces?.slice().sort()).toEqual(
			[...PROJECTION_SURFACES].sort(),
		);
		expect(declared?.evidenceRecords?.slice().sort()).toEqual(
			[CONFIG_RECORD_REL, LOCK_FACTS_RECORD_REL].sort(),
		);
		expect(declared?.currentSnapshot).toBe(CURRENT_SNAPSHOT_LOCATOR);
		for (const rel of PROJECTION_SURFACES) {
			expect(readFileSync(join(REPO_ROOT, rel), "utf8")).toContain(
				"authority=pi-operates-never-authorizes",
			);
		}
		// The checked-in evidence records are complete, labeled, and agree.
		expect(readFileSync(join(REPO_ROOT, CONFIG_RECORD_REL), "utf8")).toContain(
			"evidence_scope: current",
		);
		const lockFacts = JSON.parse(
			readFileSync(join(REPO_ROOT, LOCK_FACTS_RECORD_REL), "utf8"),
		) as { snapshotRecord?: { evidenceScope?: string; evidenceSource?: string } };
		expect(lockFacts.snapshotRecord?.evidenceScope).toBeDefined();
		if (lockFacts.snapshotRecord?.evidenceScope !== "current") {
			expect(lockFacts.snapshotRecord?.evidenceSource).toBeTruthy();
		}
		// Second, independent offline run of the same guard over the checked-in
		// candidate: the result must be identical and must need no network or secret.
		const first = await runValidator([]);
		const second = await runValidator([]);
		expect(first.code).toBe(0);
		expect(second.code).toBe(0);
		expect(second.stdout).toBe(first.stdout);
		expect(first.stdout).toContain("verify-capability-manifest: OK");
	});
});
