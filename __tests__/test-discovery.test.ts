import { describe, expect, it } from "vitest";
import config from "../vitest.config.js";

const TEST_FILE_SUFFIX = "**/*.test.ts";
const CACHE_TEST_PATH =
	"~/.bun/install/cache/example/contracts/__tests__/copied.test.ts";

describe("Vitest discovery boundaries", () => {
	it("includes every project test root without matching dependency cache copies", () => {
		const include = config.test?.include;

		expect(include).toEqual([
			"__tests__/**/*.test.ts",
			"chains/__tests__/**/*.test.ts",
		]);
		const includedRoots = include?.map((pattern) =>
			pattern.slice(0, -TEST_FILE_SUFFIX.length),
		);
		expect(includedRoots).toEqual(["__tests__/", "chains/__tests__/"]);
		expect(includedRoots?.some((root) => CACHE_TEST_PATH.startsWith(root))).toBe(
			false,
		);
	});
});
