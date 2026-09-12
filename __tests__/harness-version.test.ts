/**
 * Harness version agreement — the guard D11 requires.
 *
 * Ownership split (deliberate: one invariant, one failure site):
 *   - `package.json#/version` === `capability-manifest.yaml#/repository/version`
 *     is owned by `bun run verify:capability`
 *     (`scripts/verify-capability-manifest.mjs`).
 *   - `package.json#/version` ===
 *     `docs/architecture/program-lock-facts.json#/packageVersion`
 *     is owned by `__tests__/lock-facts.test.ts`.
 *   - `package.json#/version` === the harness-version constants is owned HERE,
 *     because nothing else couples them (`extensions/**` and this file are not
 *     members of `PARTICIPATION_PATHS_V1`).
 *
 * The assertion goes through real imports — never the literal `0.1.0`, never
 * prose, never a regex over `.ts` source — so a future legitimate bump cannot
 * produce a false RED here.
 *
 * Fiscal convention: version/sequence numbers are JSON integers, never floats.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { drenyraPiExtension } from "../extensions/register.js";
import { FISCAL_GUARD_VERSION } from "../extensions/fiscal-guard.js";

/** The reference value: the shipped package version, read once. */
function readPackageVersion(): string {
	const pkg = JSON.parse(
		readFileSync(join(process.cwd(), "package.json"), "utf8"),
	) as { version: string };
	return pkg.version;
}

/** Every harness constant that disagrees with `version`. */
function versionViolations(version: string): string[] {
	const violations: string[] = [];
	if (drenyraPiExtension.version !== version) {
		violations.push(
			`drenyraPiExtension.version ${drenyraPiExtension.version} !== ${version}`,
		);
	}
	if (FISCAL_GUARD_VERSION !== version) {
		violations.push(
			`FISCAL_GUARD_VERSION ${FISCAL_GUARD_VERSION} !== ${version}`,
		);
	}
	return violations;
}

describe("harness version agreement", () => {
	it("reports the package version as the extension version", () => {
		expect(drenyraPiExtension.version).toBe(readPackageVersion());
	});

	it("reports the package version as the fiscal guard version", () => {
		expect(FISCAL_GUARD_VERSION).toBe(readPackageVersion());
	});

	it("detects a mismatching version instead of being a tautology", () => {
		expect(versionViolations("9.9.9")).toHaveLength(2);
		expect(versionViolations(readPackageVersion())).toEqual([]);
	});
});
