/**
 * Program lock facts + candidate identity — tests for
 * docs/architecture/program-lock-facts.json and scripts/compute-candidate-identity.mjs
 * (design D3/§6, D4/§7, REQ-LOCK-001..003).
 *
 * Validates the lock-fact record shape and every cross-artifact invariant:
 * schema/version/notice, HEAD vs dirty candidate identity, package version,
 * consumed/produced contract sets, integer test arithmetic, pin checksum,
 * manifest and capability digests, capability state agreement, active changes,
 * and candidate identity re-derivation via the CLI. Also exercises the identity
 * algorithm's modified/new/deleted classification, sorted canonical manifest
 * ordering, and self-reference normalization stability.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/exit codes are JSON integers, never
 * floats.
 */

import { describe, expect, it } from "vitest";
import { execFile, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DEFAULT_PIN } from "../runtime/pin.js";

interface IdentityEntry {
	path: string;
	state: string;
	mode: string;
	sha256: string;
}

// The identity CLI is a plain .mjs module without a sibling .d.mts (not in the
// §13 apply whitelist), so the runtime module is loaded through a typed dynamic
// import with an inline interface (specifier in a variable → no static
// resolution, matching the package-verify.d.mts idiom).
const IDENTITY_URL = new URL(
	"../scripts/compute-candidate-identity.mjs",
	import.meta.url,
).href;
const {
	CANDIDATE_IDENTITY_PLACEHOLDER,
	PARTICIPATION_PATHS_V1,
	buildCanonicalManifest,
	computeCandidateIdentity,
	normalizeApplyProgress,
	normalizeConfigYaml,
	normalizeLockFacts,
} = (await import(IDENTITY_URL)) as {
	CANDIDATE_IDENTITY_PLACEHOLDER: string;
	PARTICIPATION_PATHS_V1: string[];
	buildCanonicalManifest: (args: {
		head: string;
		entries: IdentityEntry[];
	}) => string;
	computeCandidateIdentity: (options?: { cwd?: string }) => {
		identity: string;
		head: string;
		entries: IdentityEntry[];
	};
	normalizeApplyProgress: (bytes: string) => string;
	normalizeConfigYaml: (bytes: string) => string;
	normalizeLockFacts: (bytes: string) => string;
};

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const IDENTITY_SCRIPT = join(
	REPO_ROOT,
	"scripts",
	"compute-candidate-identity.mjs",
);
const LOCK_FACTS_PATH = join(
	REPO_ROOT,
	"docs",
	"architecture",
	"program-lock-facts.json",
);
const MANIFEST_REL_PATH = "capability-manifest.yaml";

const REQUIRED_CONSUMED = [
	["mission-protocol", "0.1"],
	["candidate", "0.1"],
	["receipt", "0.1"],
	["gate", "0.1"],
	["ledger", "0.1"],
	["recovery", "0.1"],
] as const;
const REQUIRED_PRODUCED = [
	["package-contract", "0.1"],
	["runtime-dependency", "0.1"],
] as const;

function sha256Hex(bytes: Buffer | string): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function readJson(path: string): Record<string, any> {
	return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

/**
 * Returns every violation of the design §6.2/§6.3 lock-fact contract for the
 * given record against the repository at `root`. Used both to validate the real
 * record (must be empty) and to reject mutated records (negative cases).
 */
function collectLockFactsViolations(
	facts: any,
	root: string = REPO_ROOT,
): string[] {
	const out: string[] = [];
	const push = (message: string) => out.push(message);

	if (facts.schemaVersion !== "drenyra.program-lock-facts.v1") {
		push("schemaVersion must be drenyra.program-lock-facts.v1");
	}
	if (facts.participantCheckpoint !== true) {
		push("participantCheckpoint must be true");
	}
	if (
		facts.authorityNotice !==
		"Pi-local input; does not modify or promote the program master"
	) {
		push("authorityNotice mismatch");
	}
	if (
		typeof facts.headSha !== "string" ||
		!/^[0-9a-f]{40}$/.test(facts.headSha) ||
		!facts.headSha.startsWith("c354274")
	) {
		push("headSha must be the 40-char lowercase HEAD SHA starting c354274");
	}
	if (
		typeof facts.candidateIdentity !== "string" ||
		!/^dirty-sha256:[0-9a-f]{64}$/.test(facts.candidateIdentity)
	) {
		push("candidateIdentity must be dirty-sha256:<64 lowercase hex>");
	} else if (facts.candidateIdentity === facts.headSha) {
		push("candidate identity must never be conflated with HEAD");
	}

	const pkg = readJson(join(root, "package.json"));
	if (facts.packageVersion !== pkg.version) {
		push(`packageVersion must equal package.json version (${pkg.version})`);
	}

	const consumed = Array.isArray(facts.contracts?.consumed)
		? facts.contracts.consumed
		: [];
	const produced = Array.isArray(facts.contracts?.produced)
		? facts.contracts.produced
		: [];
	for (const [name, version] of REQUIRED_CONSUMED) {
		if (!consumed.some((c: any) => c?.name === name && c?.version === version)) {
			push(`missing consumed contract ${name}@${version}`);
		}
	}
	for (const [name, version] of REQUIRED_PRODUCED) {
		if (!produced.some((c: any) => c?.name === name && c?.version === version)) {
			push(`missing produced contract ${name}@${version}`);
		}
	}
	const keys = [...consumed, ...produced].map((c) => `${c?.name}@${c?.version}`);
	if (new Set(keys).size !== keys.length) {
		push("contract name@version pairs must be unique");
	}

	const tests = facts.tests ?? {};
	if (tests.command !== "bun test") {
		push('tests.command must be "bun test"');
	}
	for (const field of ["files", "passed", "failed", "total"]) {
		if (!Number.isInteger(tests[field]) || tests[field] < 0) {
			push(`tests.${field} must be a non-negative integer`);
		}
	}
	if (
		Number.isInteger(tests.passed) &&
		Number.isInteger(tests.failed) &&
		Number.isInteger(tests.total) &&
		tests.passed + tests.failed !== tests.total
	) {
		push("tests arithmetic: passed + failed must equal total");
	}
	if (Number.isInteger(tests.files) && tests.files < 1) {
		push("tests.files must be >= 1");
	}

	if (facts.checksums?.pinEntrySha256 !== DEFAULT_PIN.checksumSha256) {
		push("pinEntrySha256 must equal DEFAULT_PIN.checksumSha256");
	}
	const contentManifest = facts.checksums?.contentManifest;
	if (contentManifest?.path !== "contracts/SHA256SUMS.json") {
		push('contentManifest.path must be "contracts/SHA256SUMS.json"');
	} else if (
		typeof contentManifest.sha256 !== "string" ||
		contentManifest.sha256 !==
			sha256Hex(readFileSync(join(root, contentManifest.path)))
	) {
		push("contentManifest.sha256 must match the current manifest bytes");
	}

	const capabilityStates = facts.capabilityStates;
	if (capabilityStates?.manifest !== "capability-manifest.yaml") {
		push('capabilityStates.manifest must be "capability-manifest.yaml"');
	}
	if (capabilityStates?.schemaVersion !== "drenyra.capability-manifest.v1") {
		push("capabilityStates.schemaVersion mismatch");
	}
	if (
		typeof capabilityStates?.digestSha256 !== "string" ||
		capabilityStates.digestSha256 !==
			sha256Hex(readFileSync(join(root, MANIFEST_REL_PATH)))
	) {
		push("capabilityStates.digestSha256 must match the current manifest bytes");
	}

	const capManifest = readJson(join(root, MANIFEST_REL_PATH));
	const stateCounts: Record<string, number> = {};
	for (const entry of Object.values(capManifest.capabilities ?? {})) {
		const state = (entry as any)?.state;
		stateCounts[state] = (stateCounts[state] ?? 0) + 1;
	}
	if (
		stateCounts.implemented !== 7 ||
		stateCounts.partial !== 2 ||
		stateCounts.planned !== 1
	) {
		push(
			"capability state counts must agree with the manifest (7 implemented / 2 partial / 1 planned)",
		);
	}

	const active = facts.activeChanges;
	if (!Array.isArray(active) || !active.includes("pi-sdd-010-participation")) {
		push("activeChanges must include pi-sdd-010-participation");
	}
	if (
		!Array.isArray(active) ||
		[...active].sort().join("\n") !== active.join("\n")
	) {
		push("activeChanges must be sorted");
	}

	return out;
}

function makeTempRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-identity-"));
	spawnSync("git", ["init", "-q"], { cwd: dir, encoding: "utf8" });
	spawnSync("git", ["config", "user.email", "apply@test.local"], {
		cwd: dir,
		encoding: "utf8",
	});
	spawnSync("git", ["config", "user.name", "Apply Test"], {
		cwd: dir,
		encoding: "utf8",
	});
	return dir;
}

function git(dir: string, args: string[]): void {
	const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
}

describe("program-lock-facts.json (design §6)", () => {
	const facts = readJson(LOCK_FACTS_PATH);

	it("records the exact schema, checkpoint flag, and authority notice", () => {
		expect(facts.schemaVersion).toBe("drenyra.program-lock-facts.v1");
		expect(facts.participantCheckpoint).toBe(true);
		expect(facts.authorityNotice).toBe(
			"Pi-local input; does not modify or promote the program master",
		);
	});

	it("distinguishes the full HEAD SHA from the dirty candidate identity", () => {
		expect(facts.headSha).toMatch(/^c354274[0-9a-f]{33}$/);
		expect(facts.headSha).toHaveLength(40);
		expect(facts.candidateIdentity).toMatch(/^dirty-sha256:[0-9a-f]{64}$/);
		expect(facts.candidateIdentity).not.toBe(facts.headSha);
	});

	it("matches package.json version and the required contract sets", () => {
		const pkg = readJson(join(REPO_ROOT, "package.json"));
		expect(facts.packageVersion).toBe(pkg.version);
		const consumed = facts.contracts.consumed as Array<{
			name: string;
			version: string;
		}>;
		const produced = facts.contracts.produced as Array<{
			name: string;
			version: string;
		}>;
		for (const [name, version] of REQUIRED_CONSUMED) {
			expect(consumed).toContainEqual({ name, version });
		}
		for (const [name, version] of REQUIRED_PRODUCED) {
			expect(produced).toContainEqual({ name, version });
		}
	});

	it("reports zero violations against the real repository state", () => {
		expect(collectLockFactsViolations(facts)).toEqual([]);
	});

	it("rejects a mismatched pin checksum, package version, digest, or active-change set", () => {
		expect(collectLockFactsViolations(facts)).toEqual([]);
		const cases: Array<[string, (f: any) => void, RegExp]> = [
			[
				"pin checksum",
				(f) => {
					f.checksums.pinEntrySha256 = "0".repeat(64);
				},
				/pinEntrySha256/,
			],
			[
				"package version",
				(f) => {
					f.packageVersion = "9.9.9";
				},
				/packageVersion/,
			],
			[
				"capability digest",
				(f) => {
					f.capabilityStates.digestSha256 = "0".repeat(64);
				},
				/capabilityStates\.digestSha256/,
			],
			[
				"content manifest digest",
				(f) => {
					f.checksums.contentManifest.sha256 = "0".repeat(64);
				},
				/contentManifest\.sha256/,
			],
			[
				"active-change set",
				(f) => {
					f.activeChanges = [...f.activeChanges].sort().reverse();
				},
				/activeChanges must be sorted/,
			],
		];
		for (const [label, mutate, expected] of cases) {
			const copy = JSON.parse(JSON.stringify(facts)) as Record<string, any>;
			mutate(copy);
			expect(collectLockFactsViolations(copy).join("\n"), label).toMatch(expected);
		}
	});

	it("re-derives the recorded candidate identity via the CLI", async () => {
		const { stdout } = await execFileAsync(process.execPath, [IDENTITY_SCRIPT], {
			cwd: REPO_ROOT,
		});
		const derived = stdout.trim();
		expect(derived).toMatch(/^dirty-sha256:[0-9a-f]{64}$/);
		expect(derived).toBe(facts.candidateIdentity);
	});

	it("produces a stable identity across two CLI runs", async () => {
		const first = (
			await execFileAsync(process.execPath, [IDENTITY_SCRIPT], { cwd: REPO_ROOT })
		).stdout;
		const second = (
			await execFileAsync(process.execPath, [IDENTITY_SCRIPT], { cwd: REPO_ROOT })
		).stdout;
		expect(first).toBe(second);
	});
});

describe("compute-candidate-identity.mjs (design §7.2)", () => {
	it("embeds the §13 whitelist plus planning inputs, lexicographically sorted", () => {
		expect(PARTICIPATION_PATHS_V1).toEqual([...PARTICIPATION_PATHS_V1].sort());
		expect(PARTICIPATION_PATHS_V1).toContain(
			"openspec/changes/pi-sdd-010-participation/proposal.md",
		);
		expect(PARTICIPATION_PATHS_V1).toContain(
			"openspec/changes/pi-sdd-010-participation/design.md",
		);
		expect(PARTICIPATION_PATHS_V1).toContain(
			"__tests__/capability-manifest.test.ts",
		);
	});

	it("classifies modified, new, and deleted allowlisted entries with modes, sorted by path", () => {
		const dir = makeTempRepo();
		mkdirSync(join(dir, "__tests__"), { recursive: true });
		mkdirSync(join(dir, "contracts"), { recursive: true });
		writeFileSync(join(dir, "__tests__/lock-facts.test.ts"), "// v1\n");
		writeFileSync(join(dir, "contracts/package-contract.md"), "# draft v1\n");
		git(dir, ["add", "-A"]);
		git(dir, ["commit", "-q", "-m", "baseline"]);
		// M: modify a tracked file; D: delete a tracked file; A: add a new file.
		writeFileSync(join(dir, "contracts/package-contract.md"), "# draft v2\n");
		rmSync(join(dir, "__tests__/lock-facts.test.ts"));
		writeFileSync(join(dir, "capability-manifest.yaml"), "{}\n");

		const { entries } = computeCandidateIdentity({ cwd: dir });
		const entryPaths = (entries as IdentityEntry[]).map((e) => e.path);
		expect(entryPaths).toEqual([
			"__tests__/lock-facts.test.ts",
			"capability-manifest.yaml",
			"contracts/package-contract.md",
		]);
		const byPath = new Map((entries as IdentityEntry[]).map((e) => [e.path, e]));
		expect(byPath.get("__tests__/lock-facts.test.ts")).toMatchObject({
			state: "D",
			sha256: "-",
			mode: "100644",
		});
		expect(byPath.get("capability-manifest.yaml")).toMatchObject({
			state: "A",
			mode: "100644",
			sha256: sha256Hex("{}\n"),
		});
		expect(byPath.get("contracts/package-contract.md")).toMatchObject({
			state: "M",
			mode: "100644",
			sha256: sha256Hex("# draft v2\n"),
		});
		// Entries are sorted by path; unchanged tracked files are excluded.
		expect(entryPaths).toEqual(
			[...(entries as IdentityEntry[])]
				.sort((a, b) => (a.path < b.path ? -1 : 1))
				.map((e) => e.path),
		);
		rmSync(dir, { recursive: true, force: true });
	});

	it("builds a NUL-separated canonical manifest in the documented layout", () => {
		const manifest = buildCanonicalManifest({
			head: "c354274dd5f5f6e83f291dafe9284ad9210be080",
			entries: [
				{ path: "a.ts", state: "M", mode: "100644", sha256: "ab".repeat(32) },
				{ path: "b.ts", state: "A", mode: "100755", sha256: "cd".repeat(32) },
			],
		});
		expect(manifest).toBe(
			"candidate-format\0drenyra.pi.participation.v1\n" +
				"head\0c354274dd5f5f6e83f291dafe9284ad9210be080\n" +
				"path\0a.ts\0state\0M\0mode\0" +
				"100644" +
				"\0sha256\0" +
				"ab".repeat(32) +
				"\n" +
				"path\0b.ts\0state\0A\0mode\0" +
				"100755" +
				"\0sha256\0" +
				"cd".repeat(32) +
				"\n",
		);
	});

	it("normalizes the three self-referential fields to a stable placeholder", () => {
		const raw = readFileSync(LOCK_FACTS_PATH, "utf8");
		const facts = JSON.parse(raw) as Record<string, any>;
		const normOriginal = normalizeLockFacts(raw);
		const mutated = JSON.parse(raw) as Record<string, any>;
		mutated.candidateIdentity = `dirty-sha256:${"a".repeat(64)}`;
		const normMutated = normalizeLockFacts(JSON.stringify(mutated));
		expect(normOriginal).toBe(normMutated);
		expect(normOriginal).toContain(
			`"candidateIdentity":"${CANDIDATE_IDENTITY_PLACEHOLDER}"`,
		);
		expect(normOriginal).toContain(
			'"schemaVersion":"drenyra.program-lock-facts.v1"',
		);
		expect(normalizeLockFacts(normOriginal)).toBe(normOriginal);
		expect(facts.candidateIdentity).toBeDefined();

		const config =
			"current_test_state:\n  candidate_identity: dirty-sha256:abcd\nother: keep\n";
		const configNorm = normalizeConfigYaml(config);
		expect(configNorm).toContain(
			`candidate_identity: ${CANDIDATE_IDENTITY_PLACEHOLDER}`,
		);
		expect(configNorm).toContain("other: keep");
		expect(configNorm).not.toContain("abcd");
		expect(normalizeConfigYaml(configNorm)).toBe(configNorm);

		const progress =
			"line one\n**Candidate identity:** dirty-sha256:zzz\nline two\n";
		const progressNorm = normalizeApplyProgress(progress);
		expect(progressNorm).toContain(
			`**Candidate identity:${CANDIDATE_IDENTITY_PLACEHOLDER}`,
		);
		expect(progressNorm).toContain("line one");
		expect(progressNorm).toContain("line two");
		expect(progressNorm).not.toContain("zzz");
		expect(normalizeApplyProgress(progressNorm)).toBe(progressNorm);
	});

	it("exits non-zero when no allowlisted candidate change exists", async () => {
		const dir = makeTempRepo();
		writeFileSync(join(dir, "README.md"), "not in the whitelist\n");
		git(dir, ["add", "-A"]);
		git(dir, ["commit", "-q", "-m", "baseline"]);
		let code = 0;
		try {
			await execFileAsync(process.execPath, [IDENTITY_SCRIPT], { cwd: dir });
		} catch (error) {
			code = (error as { code?: number }).code ?? 1;
		}
		expect(code).not.toBe(0);
		rmSync(dir, { recursive: true, force: true });
	});
});
