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
 *   - the real repository capability-manifest.yaml validates.
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
const DEFAULT_CAPABILITIES: Record<string, unknown> = {
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
		`${JSON.stringify({ name: "drenyra-pi", version: "0.0.1-prealpha.1" })}\n`,
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
		repository: {
			name: "drenyra-pi",
			package: "drenyra-pi",
			role: "agentic-runtime",
			version: "0.0.1-prealpha.1",
		},
		capabilities: DEFAULT_CAPABILITIES,
		testState: {
			command: "bun test",
			result: "passing",
			files: 35,
			total: 557,
			passed: 557,
			failed: 0,
			evidenceRef: "docs/architecture/program-lock-facts.json#/tests",
		},
		generatedAt: "2026-08-14T00:00:00.000Z",
		derivedFrom: ["arkelythex/drenyra-ai@4975f4f"],
	};
	const manifestPath = writeManifest(root, manifest);
	return { root, manifestPath };
}

function readManifest(manifestPath: string): Record<string, any> {
	return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, any>;
}

function writeManifestObject(
	manifestPath: string,
	manifest: Record<string, any>,
): void {
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
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

	it("validates the real repository capability-manifest.yaml", async () => {
		const result = await runValidator([]);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("verify-capability-manifest: OK");
	});
});
