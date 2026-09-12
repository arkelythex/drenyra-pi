import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFRESH_SCRIPT = join(REPO_ROOT, "scripts", "refresh-program-lock-facts.mjs");
const REFRESH_URL = new URL("../scripts/refresh-program-lock-facts.mjs", import.meta.url).href;
const { writeProgramLockFacts } = (await import(REFRESH_URL)) as {
	writeProgramLockFacts: (options: {
		cwd: string;
		currentBytes: string;
		finalBytes: string;
		rename?: (from: string, to: string) => void;
	}) => void;
};
const FACTS_RELATIVE_PATH = "docs/architecture/program-lock-facts.json";
const PIN_SHA256 =
	"09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600";
const fixtures: string[] = [];

function sha256(bytes: string): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function canonicalStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
	if (value !== null && typeof value === "object") {
		return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

function expectedFixtureIdentity(root: string, factsBytes: string): string {
	const facts = JSON.parse(factsBytes) as Record<string, unknown>;
	facts.candidateIdentity = "__CANDIDATE_IDENTITY__";
	const normalizedDigest = sha256(`${canonicalStringify(facts)}\n`);
	const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
	const manifest =
		"candidate-format\0drenyra.pi.participation.v1\n" +
		`head\0${head}\n` +
		`path\0${FACTS_RELATIVE_PATH}\0state\0M\0mode\0${"100644"}\0sha256\0${normalizedDigest}\n`;
	return `dirty-sha256:${sha256(manifest)}`;
}

function git(cwd: string, args: string[]): void {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stderr);
}

function makeFixture(): { root: string; factsPath: string } {
	const root = mkdtempSync(join(tmpdir(), "lock-facts-refresh-"));
	fixtures.push(root);
	mkdirSync(join(root, "docs/architecture"), { recursive: true });
	mkdirSync(join(root, "contracts"), { recursive: true });
	mkdirSync(join(root, "openspec/changes/archive"), { recursive: true });
	writeFileSync(join(root, "package.json"), '{"version":"1.2.3"}\n');
	writeFileSync(join(root, "contracts/SHA256SUMS.json"), '{"version":1}\n');
	writeFileSync(
		join(root, "capability-manifest.yaml"),
		'{"schemaVersion":"drenyra.capability-manifest.v1"}\n',
	);
	const facts = {
		schemaVersion: "drenyra.program-lock-facts.v1",
		participantCheckpoint: true,
		authorityNotice: "Pi-local input; does not modify or promote the program master",
		headSha: "0".repeat(40),
		candidateIdentity: `dirty-sha256:${"0".repeat(64)}`,
		packageVersion: "old",
		contracts: { consumed: [{ name: "mission-protocol", version: "0.1" }], produced: [] },
		tests: { command: "bun test", files: 48, total: 738, passed: 738, failed: 0 },
		checksums: {
			pinEntrySha256: PIN_SHA256,
			contentManifest: { path: "contracts/SHA256SUMS.json", sha256: "old" },
		},
		capabilityStates: {
			manifest: "capability-manifest.yaml",
			schemaVersion: "drenyra.capability-manifest.v1",
			digestSha256: "old",
		},
		activeChanges: [],
		evidenceDate: "2026-09-09",
		derivationCommands: ["bun test", "historical-command --unchanged"],
	};
	const factsPath = join(root, FACTS_RELATIVE_PATH);
	writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
	git(root, ["init", "-q"]);
	git(root, ["config", "user.email", "fixture@example.invalid"]);
	git(root, ["config", "user.name", "Fixture"]);
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "baseline"]);
	return { root, factsPath };
}

function run(root: string, ...args: string[]) {
	return spawnSync(process.execPath, [REFRESH_SCRIPT, ...args], {
		cwd: root,
		encoding: "utf8",
	});
}

afterEach(() => {
	for (const fixture of fixtures.splice(0)) {
		rmSync(fixture, { recursive: true, force: true });
	}
});

describe("refresh-program-lock-facts", () => {
	it("refreshes apply/archive metadata, checks without writes, and is idempotent", () => {
		const { root, factsPath } = makeFixture();
		mkdirSync(join(root, "openspec/changes/z-change"));
		mkdirSync(join(root, "openspec/changes/a-change"));
		writeFileSync(join(root, "openspec/changes/z-change/proposal.md"), "# z\n");
		writeFileSync(join(root, "openspec/changes/a-change/proposal.md"), "# a\n");
		const staleBytes = readFileSync(factsPath, "utf8");

		const stale = run(root, "--check");
		expect(stale.status).not.toBe(0);
		expect(readFileSync(factsPath, "utf8")).toBe(staleBytes);
		expect(run(root).status).toBe(0);

		const refreshedBytes = readFileSync(factsPath, "utf8");
		const refreshed = JSON.parse(refreshedBytes) as Record<string, unknown>;
		expect(refreshed.activeChanges).toEqual(["a-change", "z-change"]);
		expect(refreshed.packageVersion).toBe("1.2.3");
		expect(refreshed.headSha).toBe(spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim());
		expect(refreshed.candidateIdentity).toBe(expectedFixtureIdentity(root, refreshedBytes));
		const normalIdentity = spawnSync(process.execPath, [join(REPO_ROOT, "scripts/compute-candidate-identity.mjs")], { cwd: root, encoding: "utf8" });
		expect(normalIdentity.status).toBe(0);
		expect(normalIdentity.stdout.trim()).toBe(refreshed.candidateIdentity);
		expect(refreshed.tests).toEqual({ command: "bun test", files: 48, total: 738, passed: 738, failed: 0 });
		expect(refreshed.evidenceDate).toBe("2026-09-09");
		expect(refreshed.derivationCommands).toEqual(["bun test", "historical-command --unchanged"]);
		expect((refreshed.checksums as { pinEntrySha256: string }).pinEntrySha256).toBe(PIN_SHA256);
		expect(refreshed.capabilityStates).toEqual({
			manifest: "capability-manifest.yaml",
			schemaVersion: "drenyra.capability-manifest.v1",
			digestSha256: sha256('{"schemaVersion":"drenyra.capability-manifest.v1"}\n'),
		});
		expect(run(root, "--check").status).toBe(0);
		expect(run(root, "--write").status).toBe(0);
		expect(readFileSync(factsPath, "utf8")).toBe(refreshedBytes);

		rmSync(join(root, "openspec/changes/a-change"), { recursive: true });
		rmSync(join(root, "openspec/changes/z-change"), { recursive: true });
		expect(run(root, "--check").status).not.toBe(0);
		expect(run(root, "--write").status).toBe(0);
		expect(JSON.parse(readFileSync(factsPath, "utf8")).activeChanges).toEqual([]);
	}, 15_000);

	it("fails closed without mutating malformed or redirected checkpoints", () => {
		const { root, factsPath } = makeFixture();
		for (const invalid of [
			"{ malformed\n",
			readFileSync(factsPath, "utf8").replace(
				"contracts/SHA256SUMS.json",
				"contracts/OTHER.json",
			),
			readFileSync(factsPath, "utf8").replace(PIN_SHA256, "f".repeat(64)),
		]) {
			writeFileSync(factsPath, invalid);
			expect(run(root, "--write").status).not.toBe(0);
			expect(readFileSync(factsPath, "utf8")).toBe(invalid);
		}
	});

	it("rejects nested execution and symlink path escapes", () => {
		const { root, factsPath } = makeFixture();
		const nested = join(root, "nested");
		mkdirSync(nested);
		const nestedRun = run(nested, "--check");
		expect(nestedRun.status).not.toBe(0);
		expect(nestedRun.stderr).toContain("canonical Git top-level");

		const external = mkdtempSync(join(tmpdir(), "lock-facts-external-"));
		fixtures.push(external);
		const externalFacts = join(external, "facts.json");
		const original = readFileSync(factsPath, "utf8");
		writeFileSync(externalFacts, original);
		rmSync(factsPath);
		symlinkSync(externalFacts, factsPath);
		const escaped = run(root, "--write");
		expect(escaped.status).not.toBe(0);
		expect(escaped.stderr).toContain("symlink");
		expect(readFileSync(externalFacts, "utf8")).toBe(original);
		expect(lstatSync(factsPath).isSymbolicLink()).toBe(true);
	});

	it("cleans its temporary file and preserves the target when rename fails", () => {
		const { root, factsPath } = makeFixture();
		const original = readFileSync(factsPath, "utf8");
		expect(() =>
			writeProgramLockFacts({
				cwd: root,
				currentBytes: original,
				finalBytes: `${original}\n`,
				rename: () => {
					throw new Error("injected rename failure");
				},
			}),
		).toThrow("injected rename failure");
		expect(readFileSync(factsPath, "utf8")).toBe(original);
		expect(readdirSync(dirname(factsPath)).some((name) => name.includes(".tmp-"))).toBe(false);
		expect(existsSync(factsPath)).toBe(true);
	});
});
