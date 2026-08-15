/**
 * Type declarations for scripts/lib/style-verify.mjs (the plain-ESM style gate
 * core). Kept in sync by hand; the runtime module is the single source of
 * behavior, this file only gives TypeScript consumers precise types.
 */

/** A single style-gate violation, carrying the source location and rule. */
export interface StyleViolation {
	file: string;
	line: number;
	rule: "bom" | "crlf" | "no-final-newline" | "trailing-whitespace";
	message: string;
}

/** Every rule the engine can enforce, in report-stable order. */
export const STYLE_RULES: readonly [
	"bom",
	"crlf",
	"no-final-newline",
	"trailing-whitespace",
];

/** Owned source surface the gate covers (mirrors tsconfig include + scripts). */
export const OWNED_SOURCE_PATHS: readonly string[];

/** True when the path is inside the owned source surface. */
export function isOwnedSourcePath(relPath: string): boolean;

/**
 * Check a file's full content against the requested rules. Returns every
 * violation; an empty array means the content is clean for the given rules.
 */
export function checkSourceContent(
	content: string,
	options?: {
		label?: string;
		rules?: readonly StyleViolation["rule"][];
	},
): StyleViolation[];

/**
 * Check the added lines of a unified diff for trailing whitespace. Violations
 * carry the source file (from `+++ b/...` headers) and the source line (from
 * hunk counters), not the diff line.
 */
export function checkAddedLines(
	diffText: string,
	options?: { label?: string },
): StyleViolation[];
