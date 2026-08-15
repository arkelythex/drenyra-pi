/**
 * Status/capabilities rendering + structured results (design §9, §10.3;
 * REQ-CMD-008/009/010).
 *
 * `renderStatusView` composes `buildAccountingStatus` — the read-only
 * projection — into a human summary plus machine-readable JSON carrying the
 * active company/period, mission state, next authorized action, linked
 * sources, pending reconciliations, material anomalies, required approvals,
 * and the evidence-graph projection (REQ-CMD-009). `renderCapabilitiesView`
 * reports the engine `getCapabilities()` plus harness capabilities: authority
 * modes, registered commands, and the 10 scope elements (REQ-CMD-010).
 *
 * These helpers are thin: they compose persisted projections and constants and
 * contain no accounting or fiscal logic (REQ-CMD-004).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { getCapabilities } from "drenyra-ai/missions";
import type { MissionSnapshot } from "drenyra-ai/missions";
import {
  buildAccountingStatus,
  type AccountingStatusView,
  type EvidenceStatusProjectionInput,
} from "../lib/accounting-status.js";
import type { CanonicalScopeReport } from "../runtime/context.js";
import type { ScopeBinding } from "../lib/canonicalization.js";
import type { RuntimeStatus } from "../runtime/status.js";

/** The structured output shape of every command (REQ-CMD-008). */
export interface CommandOutput {
  /** Concise human-readable summary. */
  summary: string;
  /** Machine-readable, JSON-serializable result. */
  machine: unknown;
}

/** Inputs for the status renderer (design §9 projection inputs). */
export interface StatusViewInput {
  /** Active company RUC from the context store, when set. */
  company?: string;
  /** Active fiscal period from the context store, when set. */
  period?: string;
  runtime: RuntimeStatus;
  scopeReport: CanonicalScopeReport;
  binding?: ScopeBinding;
  mission?: MissionSnapshot;
  /** Linked source references (REQ-CMD-009), when the caller has them. */
  linkedSources?: readonly string[];
  /** Pending reconciliation count (REQ-CMD-009), when persisted state has it. */
  pendingReconciliations?: number;
  /** Extra pending-approval count reported by gate callers. */
  pendingApprovals?: number;
  /** Evidence graph projection input (read-only, fail-closed; design §7/§9). */
  evidence?: EvidenceStatusProjectionInput;
}

/** Render the read-only status view (REQ-CMD-009). */
export async function renderStatusView(input: StatusViewInput): Promise<CommandOutput> {
  const view = await buildAccountingStatus({
    runtime: input.runtime,
    scopeReport: input.scopeReport,
    binding: input.binding,
    mission: input.mission,
    pendingApprovals: input.pendingApprovals,
    linkedSources: input.linkedSources,
    pendingReconciliations: input.pendingReconciliations,
    evidence: input.evidence,
  });

  const summary = summarizeStatus(view, input.company, input.period);
  return { summary, machine: view };
}

/** One-line mission/next-action summary segment. */
function summarizeMission(view: AccountingStatusView): string {
  const mission = view.mission;
  if (mission === undefined) {
    return "mission: none";
  }
  const progress = Math.round(mission.progress * 100);
  const next = view.nextAuthorizedAction;
  const nextText =
    next === undefined
      ? "next: none"
      : `next: ${next.actionFamily} (${next.requiredMode}) — ${next.reason}`;
  return (
    `mission: ${mission.id} · ${mission.status} (intent ${mission.intent}, ` +
    `progress ${progress}%, step ${mission.currentStep}) · ${nextText}`
  );
}

/** Human summary of the full status view (REQ-CMD-009 elements). */
function summarizeStatus(view: AccountingStatusView, company?: string, period?: string): string {
  const scopeText = view.scope.complete
    ? "complete"
    : `incomplete (missing: ${view.scope.missing.join(", ")})`;
  return [
    `drenyra:status — company ${company ?? "NOT SET"} · period ${period ?? "NOT SET"} · scope ${scopeText}`,
    `runtime: ${view.runtime.summary}`,
    summarizeMission(view),
    `linked sources: ${view.linkedSources?.length ?? 0}`,
    `pending reconciliations: ${view.pendingReconciliations ?? 0}`,
    `material anomalies: ${view.authority.anomalies}`,
    `required approvals: ${view.authority.approvalsPending}`,
    `evidence: ${
      view.evidence.available
        ? `verified (${view.evidence.nodeIds?.length ?? 0} graph node(s))`
        : "unavailable"
    }`,
  ].join("\n");
}

/** Inputs for the capabilities renderer (REQ-CMD-010). */
export interface CapabilitiesViewInput {
  version: string;
  commands: readonly string[];
  authorityModes: readonly string[];
  scopeElements: readonly string[];
}

/** Render engine + harness capabilities (REQ-CMD-010). */
export function renderCapabilitiesView(input: CapabilitiesViewInput): CommandOutput {
  const engine = getCapabilities();
  const machine = {
    engine,
    harness: {
      version: input.version,
      commands: [...input.commands],
      authorityModes: [...input.authorityModes],
      scopeElements: [...input.scopeElements],
    },
  };
  const summary =
    `drenyra-pi ${input.version} capabilities — engine protocol ${engine.protocolVersion} ` +
    `(${engine.features.length} features) · harness: ${input.commands.length} commands, ` +
    `${input.authorityModes.length} authority modes, ${input.scopeElements.length} scope elements`;
  return { summary, machine };
}

/**
 * The documented model-routing registry (T-S4A-004 `models` command). The
 * installed Pi ExtensionAPI slice exposes no model-routing API (G30), so this
 * is a documented capability registry: model suggestions are advisory and never
 * grant authority (design §15 "No model authority").
 */
export const MODEL_ROUTING_REGISTRY = {
  version: "drenyra.model-routing.v1",
  note:
    "Documented capability registry only — the installed Pi ExtensionAPI slice exposes " +
    "no model-routing API (G30). Model suggestions are advisory and never grant authority.",
  routing: [
    { phase: "intake", role: "clerk", guidance: "scope-first intake; no interpretation" },
    { phase: "bind-scope", role: "clerk", guidance: "bind the exact 10-element canonical scope" },
    { phase: "ingest", role: "ledger-analyst", guidance: "ingest bounded source references only" },
    { phase: "normalize", role: "ledger-analyst", guidance: "deterministic normalization, BigInt cents" },
    { phase: "classify", role: "ledger-analyst", guidance: "classify with cited evidence" },
    { phase: "reconcile", role: "reconciliation-agent", guidance: "reconcile with anomaly detection" },
    { phase: "investigate", role: "accounting-scout", guidance: "investigate anomalies with evidence" },
    { phase: "propose", role: "close-controller", guidance: "evidence-cited proposal only" },
    { phase: "verify", role: "evidence-builder", guidance: "verify integrity, never mutate" },
    { phase: "approve", role: "tax-controller-pe", guidance: "human approval; never self-approve" },
    { phase: "execute", role: "close-controller", guidance: "execute the exact approved target" },
    { phase: "close", role: "close-controller", guidance: "seal output; completion receipt" },
    { phase: "archive", role: "close-controller", guidance: "archive with signed completion receipt" },
  ],
} as const;

/** Render the documented model-routing registry (REQ-CMD-008 output shape). */
export function renderModelsRegistry(): CommandOutput {
  const summary =
    `drenyra model-routing registry ${MODEL_ROUTING_REGISTRY.version} — ` +
    `${MODEL_ROUTING_REGISTRY.routing.length} phases mapped ` +
    `(documented; no Pi model-routing API in this slice)`;
  return { summary, machine: MODEL_ROUTING_REGISTRY };
}
