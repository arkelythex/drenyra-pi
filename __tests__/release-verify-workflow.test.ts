/**
 * Release verification workflow — static checks for
 * .github/workflows/release-verify.yml:
 *
 *   1. The gate is verification-only: it must never publish to a registry,
 *      create GitHub releases, push tags, mutate dist-tags, or require registry
 *      credentials / OIDC — and it must say so in its completion output.
 *   2. It is manually dispatched from protected default `main` with a single
 *      exact annotated vSemVer tag input.
 *   3. It fails closed on every authority agreement: strict vSemVer tag syntax,
 *      exactly-once remote resolution, annotated tag, peeled tag commit ==
 *      remote main == dispatch commit == checkout commit, and
 *      `v{package.json version}` match — and it rechecks remote authority after
 *      the verification steps so an advanced main or tag mismatch fails closed.
 *   4. It re-runs the frozen install, typecheck, test, package verification, and
 *      packed-install proof on the verified (detached) tag target.
 *   5. Supply-chain posture matches the repo CI: least-privilege permissions,
 *      immutable SHA action pins, `persist-credentials: false`, frozen install.
 *      Because the repository is private, every step that interpolates
 *      GITHUB_TOKEN into an authenticated remote URL must explicitly map the
 *      ephemeral run token from `github.token` into its own environment; the
 *      token is never persisted into git config.
 *
 * These are text-level invariants, so the test stays hermetic (no build, no
 * network, no dependency on a YAML library).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "release-verify.yml");
const RELEASING_PATH = join(REPO_ROOT, "RELEASING.md");

const workflow = readFileSync(WORKFLOW_PATH, "utf8");
const releasing = readFileSync(RELEASING_PATH, "utf8");

/**
 * Step blocks that interpolate GITHUB_TOKEN into an authenticated remote URL.
 * Each such step must explicitly map the ephemeral run token from github.token
 * into its own environment — otherwise the remote reads run unauthenticated
 * and fail closed in a private repository.
 */
function remoteReadStepBlocks(): string[] {
	const stepsStart = workflow.indexOf("steps:");
	const stepsEnd = workflow.indexOf("jobs:", stepsStart + 1);
	const stepsText = workflow.slice(stepsStart, stepsEnd === -1 ? undefined : stepsEnd);
	return stepsText
		.split(/\n {6}- name: /)
		.slice(1)
		.map((block) => `- name: ${block}`)
		.filter((block) => block.includes("x-access-token:${GITHUB_TOKEN}"));
}

/** Action uses must stay immutable SHA pins (dependabot rewrites them). */
const SHA_PINS: Array<[string, string]> = [
  ["actions/checkout", "11bd71901bbe5b1630ceea73d27597364c9af683"],
  ["oven-sh/setup-bun", "0c5077e51419868618aeaa5fe8019c62421857d6"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
];

/** Anything here would turn the gate into a publish/release path. */
const FORBIDDEN_COMMANDS = [
  "npm publish",
  "npm unpublish",
  "npm dist-tag",
  "gh release",
  "git push",
  "NODE_AUTH_TOKEN",
  "registry-url",
  "id-token: write",
  "--provenance",
];

describe("release-verify workflow: no-publish gate", () => {
	it("is a verification-only workflow (never publishes, releases, or pushes)", () => {
		for (const forbidden of FORBIDDEN_COMMANDS) {
			expect(
				workflow,
				`workflow must not contain the publish-path token ${forbidden}`,
			).not.toContain(forbidden);
		}
	});

	it("is manually dispatched from default main with a single exact vSemVer tag input", () => {
		const onStart = workflow.indexOf("\non:");
		const onEnd = workflow.indexOf("\npermissions:");
		expect(onStart).toBeGreaterThan(-1);
		expect(onEnd).toBeGreaterThan(onStart);
		const onBlock = workflow.slice(onStart + 1, onEnd);
		expect(onBlock).toContain("workflow_dispatch:");
		expect(onBlock).not.toMatch(/\b(push|pull_request|schedule|release|workflow_call):/);

		const inputs = workflow.match(/inputs:\n((?:[ \t]+.*\n)+)/);
		expect(inputs, "workflow_dispatch must declare inputs:").not.toBeNull();
		const inputNames = [
			...(inputs![1].matchAll(/^[ \t]{6}([a-zA-Z0-9_-]+):/gm)),
		].map((m) => m[1]);
		expect(inputNames).toEqual(["tag"]);
		expect(inputs![1]).toContain("required: true");
		expect(inputs![1]).toContain("type: string");
	});

	it("fails closed on every release-authority agreement", () => {
		// Strict exact vSemVer syntax gate (no leading zeros, no free-form tags).
		expect(workflow).toContain("semverTag");
		expect(workflow).toContain("is not exact vSemVer");
		// Exactly-once remote resolution, in the initial validation and the recheck.
		expect(workflow).toContain("must resolve exactly once");
		expect(workflow).toContain("must still resolve exactly once");
		// Annotated-tag requirement.
		expect(workflow).toContain("must be annotated");
		// Peeled tag == remote main == dispatch == checkout agreement.
		expect(workflow).toContain("tag_commit");
		expect(workflow).toContain("remote_main");
		expect(workflow).toContain("event_commit");
		expect(workflow).toContain("checkout_commit");
		expect(workflow).toContain("must be identical");
		// package.json version must equal the tag.
		expect(workflow).toContain("v${package_version}");
	});

	it("rechecks remote authority after verification and fails closed on drift", () => {
		const installIdx = workflow.indexOf("bun install --frozen-lockfile");
		const recheckIdx = workflow.indexOf("EXPECTED_MAIN_COMMIT");
		const reportIdx = workflow.indexOf("Report no-publish completion");
		expect(installIdx).toBeGreaterThan(-1);
		expect(recheckIdx).toBeGreaterThan(installIdx);
		expect(reportIdx).toBeGreaterThan(recheckIdx);
		expect(workflow).toContain("EXPECTED_TAG_OBJECT");
		expect(workflow).toContain("EXPECTED_RELEASE_COMMIT");
		expect(workflow).toContain("Release authority changed");
	});

	it("re-runs frozen install, typecheck, test, package verification, and packed-install proof", () => {
		expect(workflow).toContain("bun install --frozen-lockfile");
		expect(workflow).toContain("bun run typecheck");
		expect(workflow).toContain("bun run test");
		expect(workflow).toContain("bun run verify:package");
		expect(workflow).toContain("node scripts/verify-packed-install.mjs");
	});

	it("derives the future dist-tag (latest/beta/next) and names it in the no-publish summary", () => {
		expect(workflow).toContain('dist_tag="latest"');
		expect(workflow).toContain('dist_tag="beta"');
		expect(workflow).toContain('dist_tag="next"');
		expect(workflow).toContain("derived future dist-tag");
		expect(workflow).toMatch(/NO PUBLISH/i);
		// The summary must name the verified tag and commit.
		expect(workflow).toContain("VERIFIED_TAG");
		expect(workflow).toContain("VERIFIED_COMMIT");
	});

	it("applies the repo supply-chain posture", () => {
		// Workflow-level and job-level least privilege.
		expect(workflow).toMatch(/permissions:\n\s+contents: read/);
		expect((workflow.match(/contents: read/g) ?? []).length).toBeGreaterThanOrEqual(2);
		// No write scope anywhere.
		expect(workflow).not.toMatch(/permissions:\n\s+(?!contents: read)[a-z_-]+:/);
		// Immutable SHA pins with tag comments.
		for (const [action, sha] of SHA_PINS) {
			expect(
				workflow,
				`${action} must be pinned to immutable SHA ${sha}`,
			).toContain(`uses: ${action}@${sha} #`);
		}
		// No persisted credentials; frozen dependency install.
		expect(workflow).toContain("persist-credentials: false");
		// Private-repository authenticated remote reads: every step that
		// interpolates GITHUB_TOKEN into a remote URL must explicitly map the
		// ephemeral run token from github.token into its own environment, and
		// the token must never be persisted to git config.
		const remoteReadBlocks = remoteReadStepBlocks();
		expect(remoteReadBlocks.length).toBe(2);
		for (const block of remoteReadBlocks) {
			expect(block).toContain("GITHUB_TOKEN: ${{ github.token }}");
		}
		// Dispatch-from-main guard and repository guard.
		expect(workflow).toContain("refs/heads/main");
		expect(workflow).toContain("default_branch");
		expect(workflow).toContain("github.repository == 'arkelythex/drenyra-pi'");
	});
});

describe("RELEASING.md: private-repository release state", () => {
	it("documents the verification-only release gate and the private state", () => {
		expect(releasing).toContain("release-verify.yml");
		expect(releasing).toMatch(/no publish|verification-only|does not publish/i);
		expect(releasing).toContain("private");
	});

	it("documents conditions for a future publish step without instructing publication today", () => {
		expect(releasing).toMatch(/future publish/);
		// The doc must not hand anyone a publish command for the current state.
		expect(releasing).not.toContain("npm publish");
	});
});
