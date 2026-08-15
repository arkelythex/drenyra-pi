/**
 * Evidence status — read-only, fail-closed loader for the status projection
 * (design §7/§9).
 *
 * The loader reads the mission's evidence graph log at
 * `<storesRoot>/.local/evidence/<mission-id>.ndjson` through the immutable
 * `EvidenceGraphStore` (append-only, payload hashes recomputed on load). It
 * performs NO mutation. The result feeds `projectEvidenceStatus` in
 * accounting-status.ts, which owns the fail-closed projection: evidence is
 * reported available only when the log exists, every line parses, and full
 * integrity validation passes (REQ-EVID-008; SC-EVID-003). A missing log, a
 * malformed/truncated line, an unsafe mission id, or an integrity violation is
 * surfaced as `error`/invalid validation — never implied valid.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EvidenceStatusProjectionInput } from "./accounting-status.js";
import { EvidenceGraphStore } from "./evidence-graph.js";
import { isSafeStoreIdentifier } from "./authority-store.js";

/** Input for `loadEvidenceStatus`: the durable stores root + target mission. */
export interface EvidenceStatusLoadInput {
  /** The durable stores root (`.local/evidence/<mission-id>.ndjson`). */
  storesRoot: string;
  /** The mission whose graph is projected. */
  missionId: string;
}

/**
 * Load the evidence graph projection input for a mission (read-only, fail
 * closed). A missing log, an unsafe mission id, or a malformed/truncated line
 * surfaces as `error`; an integrity violation (tampered payload, cycle, missing
 * endpoint, ungrounded conclusion/action) passes through as invalid validation.
 * The projection in accounting-status.ts turns both into unavailable evidence —
 * never implied valid (REQ-EVID-008; SC-EVID-003).
 */
export async function loadEvidenceStatus(
  input: EvidenceStatusLoadInput,
): Promise<EvidenceStatusProjectionInput> {
  if (!isSafeStoreIdentifier(input.missionId)) {
    return {
      missionId: input.missionId,
      error: `mission id "${input.missionId}" is not a safe store identifier — evidence unavailable`,
    };
  }
  const logPath = join(
    input.storesRoot,
    ".local",
    "evidence",
    `${input.missionId}.ndjson`,
  );
  if (!existsSync(logPath)) {
    return {
      missionId: input.missionId,
      error: `no evidence graph log for mission ${input.missionId} — evidence unavailable`,
    };
  }
  const store = new EvidenceGraphStore(input.storesRoot);
  let graph;
  try {
    graph = await store.load(input.missionId);
  } catch (cause) {
    return {
      missionId: input.missionId,
      error:
        `evidence graph for mission ${input.missionId} is malformed — evidence ` +
        `unavailable until repaired (${cause instanceof Error ? cause.message : String(cause)})`,
    };
  }
  const validation = await store.validate(input.missionId);
  return { missionId: input.missionId, graph, validation };
}
