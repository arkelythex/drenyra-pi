/**
 * `package.json#scripts.postinstall` — the install hook contract (`REQ-REL-004`, unit D5).
 *
 * The stored value is the **shell command** npm runs (`node -e "…"`), so the suite
 * executes that exact string through `sh -c` — npm's POSIX lifecycle shell — in a
 * temp cwd, and asserts the observed process contract instead of reading the
 * source. (Spawning `node -e <value>` would double-wrap the stored `node -e`.)
 *
 *   1. absent installer  -> visible warning on **stderr**, still exit 0
 *                           (CI and `release-verify` run `bun install --frozen-lockfile`
 *                           before any build, when no compiled installer can exist);
 *   2. present installer -> the installer runs, its exit status propagates,
 *                           stdout stays clean and no warning is printed;
 *   3. failing installer -> its non-zero status propagates (the `?? 1` fallback must
 *                           not swallow a real failure).
 *
 * Assertions are behavioural: they pin the stable fragments the design specifies
 * (the `WARNING` marker, the missing path, the `bun run build` remedy) and never the
 * full warning sentence, so rewording the advisory cannot red the suite.
 */
import { spawnSync } from "node:child_process";
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
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The hook is not spawned directly (`bun test`'s `process.execPath` is bun, which
// has no CommonJS `require` in `-e`): it goes through the shell npm itself uses.
const LIFECYCLE_SHELL = "sh";
const INSTALLER_RELATIVE_PATH = "dist/scripts/install-drenyra-ai.js";
const FIXTURE_MARKER = "FIXTURE_INSTALLER_RAN";
const WARNING_PATTERN = /WARNING/i;
const REMEDY_FRAGMENT = "bun run build";

const pkg = JSON.parse(
	readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const POSTINSTALL = pkg.scripts.postinstall;

const tempDirs: string[] = [];

afterEach(() => {
	while (tempDirs.length > 0) {
		rmSync(tempDirs.pop() as string, { recursive: true, force: true });
	}
});

function makeTempCwd(): string {
	const cwd = mkdtempSync(join(tmpdir(), "pi-postinstall-"));
	tempDirs.push(cwd);
	return cwd;
}

function writeInstallerFixture(cwd: string, source: string): void {
	const installer = join(cwd, INSTALLER_RELATIVE_PATH);
	mkdirSync(dirname(installer), { recursive: true });
	writeFileSync(installer, source, "utf8");
}

interface HookResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

/**
 * Run the repository's real `postinstall` value in `cwd`, through the lifecycle
 * shell, and capture the observable process contract.
 */
function runHook(cwd: string): HookResult {
	const result = spawnSync(LIFECYCLE_SHELL, ["-c", POSTINSTALL], {
		cwd,
		encoding: "utf8",
	});
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("package.json postinstall hook", () => {
	it("warns on stderr and still exits 0 when the compiled installer is absent", () => {
		const cwd = makeTempCwd();

		const result = runHook(cwd);

		expect(result.status).toBe(0);
		expect(result.stderr).toMatch(WARNING_PATTERN);
		expect(result.stderr).toContain(INSTALLER_RELATIVE_PATH);
		expect(result.stderr).toContain(REMEDY_FRAGMENT);
		expect(result.stdout).toBe("");
		// `REQ-REL-004` scenario 4: one bounded line, so the warning cannot be
		// interleaved with captured npm diagnostics. Shell metacharacters in the
		// message (backticks, `$`) would be substituted by the lifecycle shell and
		// add both a stray line and an unrequested command.
		expect(
			result.stderr.split("\n").filter((line) => line.trim() !== ""),
		).toHaveLength(1);
	});

	it("runs the compiled installer, propagates success, and prints no warning", () => {
		const cwd = makeTempCwd();
		writeInstallerFixture(
			cwd,
			`console.log(${JSON.stringify(FIXTURE_MARKER)});\n`,
		);

		const result = runHook(cwd);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(FIXTURE_MARKER);
		expect(result.stderr).not.toMatch(WARNING_PATTERN);
	});

	it("propagates a failing installer's exit status instead of the ?? 1 fallback", () => {
		const cwd = makeTempCwd();
		writeInstallerFixture(
			cwd,
			`console.log(${JSON.stringify(FIXTURE_MARKER)});\nprocess.exit(3);\n`,
		);

		const result = runHook(cwd);

		expect(result.status).toBe(3);
		expect(result.stdout).toContain(FIXTURE_MARKER);
	});
});
