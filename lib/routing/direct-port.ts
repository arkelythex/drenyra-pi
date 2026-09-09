/**
 * `direct` routing port — pi-accounting-orchestration (design "direct port
 * implementation shape"). Mirrors `createDurableMissionRoutingPort`
 * (`lib/mission-commands.ts:672-752`), the ONE existing production port, but
 * dispatches through `runChainStep` (`lib/chain-pipeline.ts:934`) instead of
 * `EdaMissionCoordinator.advance()`. The port never reimplements
 * fiscal-authority, materiality, or Core route-decision logic (REQ-BOUND-001);
 * it maps ONE bounded `runChainStep` call into a typed
 * `RouteExecutionPortResponse` and nothing more — no retry, no fall-through.
 *
 * The factory is bound to exactly one `ChainDefinition` at construction time
 * (e.g. `chains/verify.ts`'s `verifyChain`); the returned port ignores
 * `RouteExecutionInput.chain` and always dispatches the closed-over chain,
 * with the caller's `chainRun` supplying binding/input/materiality/etc.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { WaitReason, type MissionSnapshot } from "drenyra-ai/missions";
import type { WorkStopReason, WorkUnit } from "drenyra-ai";
import {
  runChainStep,
  type ChainBlocked,
  type ChainDefinition,
} from "../chain-pipeline.js";
import type { RoutingExecutionPorts } from "./types.js";

/**
 * A typed adapter stop for a human-wait state reported by `runChainStep`
 * (published `WorkStopReason` kinds only). Mirrors `waitStopFor` in
 * `lib/mission-commands.ts` for the direct/chain-pipeline seam — never
 * fabricated, never an authority grant.
 */
function waitStopForChain(unit: WorkUnit, waitReason: WaitReason): WorkStopReason {
  switch (waitReason) {
    case WaitReason.EVIDENCE: {
      const hashes = unit.evidenceAllowed.map((ref) => ref.hash);
      if (hashes.length > 0) {
        return { kind: "MISSING_EVIDENCE", requiredHashes: hashes };
      }
      return { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] };
    }
    case WaitReason.APPROVAL:
    case WaitReason.POLICY_GATE:
      return { kind: "APPROVAL_REQUIRED", approvalType: "human" };
    case WaitReason.EXTERNAL_SYSTEM:
      return {
        kind: "EXTERNAL_SYSTEM_UNAVAILABLE",
        systemId: "direct-chain-pipeline",
      };
    case WaitReason.MANUAL_INTERVENTION:
      return { kind: "APPROVAL_REQUIRED", approvalType: "manual-intervention" };
  }
}

/**
 * A typed adapter stop for a chain-level fail-closed block (scope, mode, or
 * an authority-gate stage) — before any mission write. `ChainBlocked` is a
 * generic `{stage, reason}` pair, not one of the published `WorkStopReason`
 * kinds, so it is reported as an honest `AMBIGUOUS_INPUT` naming the blocked
 * stage rather than inventing a more specific typed stop.
 */
function blockedStopForChain(blocked: ChainBlocked): WorkStopReason {
  return { kind: "AMBIGUOUS_INPUT", fields: [`chain.blocked.${blocked.stage}`] };
}

/**
 * Build a `direct` execution port bound to one chain (design "direct port
 * implementation shape"). Calls `runChainStep(chain, input.chainRun)` exactly
 * once per invocation and maps the `ChainRunResult` into a
 * `RouteExecutionPortResponse`: `missionBefore` is the caller's pre-call
 * snapshot, `missionAfter` is `result.mission` (falling back to
 * `missionBefore` when the chain blocked before any mission was loaded or
 * created), and `stop` is derived from `result.blocked` / `result.waitReason`.
 * Consumption is synthesized as a single bounded attempt (chains do not
 * report token/cost consumption) — the same pattern
 * `createDurableMissionRoutingPort` uses for its `elapsedMs: 0, tokens: 0`.
 */
export function createChainPipelineRoutingPort(
  chain: ChainDefinition<unknown, unknown>,
): RoutingExecutionPorts["direct"] {
  return async (input) => {
    const missionBefore: MissionSnapshot = input.mission;
    const result = await runChainStep(chain, input.chainRun);
    const missionAfter: MissionSnapshot = result.mission ?? missionBefore;

    let stop: WorkStopReason | undefined;
    if (result.blocked !== undefined) {
      stop = blockedStopForChain(result.blocked);
    } else if (result.waitReason !== undefined) {
      stop = waitStopForChain(input.workUnit, result.waitReason);
    }

    return {
      missionBefore,
      missionAfter,
      evidenceRefs: input.workUnit.evidenceAllowed,
      candidates: [],
      unresolvedExceptions: [],
      toolProvenance: [],
      consumption: {
        elapsedMs: 0,
        tokens: 0,
        costIncurredCents: 0n,
        researchAttempts: 1,
        correctionAttempts: 0,
      },
      ...(stop === undefined ? {} : { stop }),
    };
  };
}
