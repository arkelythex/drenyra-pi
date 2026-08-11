/**
 * Shared fail-closed parse helpers for the Drenyra Pi stores and chains.
 *
 * Every store and chain module parses either a single JSON document or an NDJSON
 * log and fails closed (throw, or treat the source as unavailable) on corrupt
 * input. This module consolidates that behavior so call sites cannot drift apart;
 * it deliberately parameterizes every per-site difference instead of
 * standardizing it away:
 *
 * - `parseJsonOrThrow` preserves each site's throw-vs-empty contract and error
 *   label; `includeMessage` controls whether the raw parser message is appended.
 * - `eachNdjsonLine` preserves each site's line-splitting semantics (`"\n"` vs
 *   `/\r?\n/`) and skips blank/whitespace lines exactly like the previous
 *   inline loops did.
 *
 * The consolidation never changes NDJSON formats, persistence schemas, or the
 * fail-closed policy of any store or chain.
 */

/**
 * Parse a single JSON value; on failure throws Error(label [— rawMessage]).
 *
 * When `opts.includeMessage` is true the raw parser message is appended to the
 * label (`Error(`${label} — ${message}`)`); otherwise the error carries the
 * label verbatim.
 */
export function parseJsonOrThrow<T>(
  input: string,
  label: string,
  opts?: { includeMessage?: boolean },
): T {
  try {
    return JSON.parse(input) as T;
  } catch (error) {
    if (opts?.includeMessage === true) {
      throw new Error(`${label} — ${(error as Error).message}`);
    }
    throw new Error(label);
  }
}

/**
 * Iterate non-empty NDJSON lines, calling onLine for each. Default split = "\n".
 *
 * Blank and whitespace-only lines are skipped, matching the previous inline
 * `for (const line of raw.split(split)) { if (line.trim().length === 0) continue; ... }`
 * loops byte-for-byte.
 */
export function eachNdjsonLine(
  raw: string,
  onLine: (line: string) => void,
  split: string | RegExp = "\n",
): void {
  for (const line of raw.split(split)) {
    if (line.trim().length === 0) {
      continue;
    }
    onLine(line);
  }
}
