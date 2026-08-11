/**
 * Verify chain — the EDA `verify` intent chain (design §11.4; REQ-CHAIN-003;
 * SC-CHAIN-003).
 *
 * The chain runs a `verify` mission through the shared `runChainStep` pipeline
 * and performs a fixed check list — source snapshot integrity (the canonical
 * digest of the bounded source manifest must match the scope's recorded
 * `sourceSnapshot`), deterministic normalization, ledger equations (total debits
 * equal total credits in BigInt cents), reconciliation correctness (bank
 * statements match the ledger net amounts), evidence graph integrity, scope
 * binding, and receipt binding where applicable. Each check reports a per-check
 * verdict; the first blocking verdict throws `VerifyChainBlockedError` and no
 * further stage runs (SC-CHAIN-003). The chain is READ-ONLY: it never appends
 * evidence nodes/edges, never writes receipts, and never mutates accounting
 * outputs (REQ-AUTH-009). The propose/approve/execute/close ceremony is
 * conditional for the verify intent and deterministically skipped (no proposal,
 * no approvals, no completion receipt).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or integer decimal strings at JSON boundaries — never floats);
 * digests are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { AUTHORITY_MODE } from "../runtime/context.js";
import { EDA_PHASE, type EdaPhase } from "../lib/accounting-status.js";
import { bindScope, sha256Canonical, type ScopeBinding } from "../lib/canonicalization.js";
import { AuthorityStore } from "../lib/authority-store.js";
import { parseJsonOrThrow } from "../lib/parse.js";
import type { EvidenceGraphStore } from "../lib/evidence-graph.js";
import {
  ReceiptStore,
  type HarnessReceiptRecord,
} from "../lib/receipt-store.js";
import type {
  ChainDefinition,
  ChainStepContext,
  ChainStepOutcome,
} from "../lib/chain-pipeline.js";
import type { MissionSnapshot } from "drenyra-ai/missions";

/** One ledger entry in the bounded source manifest. */
export interface VerifyLedgerEntry {
  account: string;
  reference: string;
  /** Money as JSON integer cents or an integer decimal string — never a float. */
  debitCents: number | string;
  creditCents: number | string;
}

/** One bank movement in the bounded source manifest. */
export interface VerifyBankEntry {
  reference: string;
  /** Money as JSON integer cents or an integer decimal string — never a float. */
  amountCents: number | string;
}

/** The bounded source content the verify chain checks (no ambient lookup). */
export interface VerifySourceManifest {
  /** The double-entry journal (account-level legs). */
  ledger: readonly VerifyLedgerEntry[];
  /** Bank statements per reference. */
  bank: readonly VerifyBankEntry[];
  /**
   * The bank/cash account id whose legs reconcile against the statements. When
   * absent, the whole journal net per reference is used.
   */
  bankAccount?: string;
}

/** Chain input: the source content plus optional target mission/receipt. */
export interface VerifyChainInput {
  manifest?: VerifySourceManifest;
  /** The mission whose graph + receipt are verified; defaults to this chain's mission. */
  missionId?: string;
  /** An explicit receipt to verify; defaults to the target mission's receiptHash. */
  receiptHash?: string;
}

/** The fixed verify check identifiers (REQ-CHAIN-003; design §11.4). */
export type VerifyCheckId =
  | "source-integrity"
  | "normalization"
  | "ledger-equations"
  | "reconciliation-correctness"
  | "graph-integrity"
  | "scope-binding"
  | "receipt-binding";

/** One per-check verdict. `fail` is blocking: no further stage runs. */
export interface VerifyCheckResult {
  check: VerifyCheckId;
  verdict: "pass" | "fail";
  detail: string;
}

/** The chain's deterministic outcome for one phase. */
export interface VerifyRunOutput {
  phase: EdaPhase;
  verdict: "verified" | "issues";
  checks: readonly VerifyCheckResult[];
}

/** Bounded manifest size (REQ-CHAIN-006). */
const MAX_MANIFEST_ENTRIES = 500;

/** Safe reference/account ids. */
const REFERENCE_RE = /^[A-Za-z0-9._:/-]{1,256}$/;

/** Integer decimal money at the boundary (JSON integer or decimal string). */
const INTEGER_RE = /^-?\d+$/;

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Thrown when a verify check fails: carries the structured per-check verdicts so
 * callers can report the exact issues (verified | issues[]). The pipeline rejects
 * before any write — no further stage runs (SC-CHAIN-003).
 */
export class VerifyChainBlockedError extends Error {
  readonly phase: EdaPhase;
  readonly checks: readonly VerifyCheckResult[];

  constructor(phase: EdaPhase, checks: readonly VerifyCheckResult[]) {
    const failing = checks.find((check) => check.verdict === "fail");
    super(
      `verify chain blocked at ${phase}: ${failing?.detail ?? "a check failed"} — no further stage runs`,
    );
    this.name = "VerifyChainBlockedError";
    this.phase = phase;
    this.checks = checks;
  }
}

/**
 * Convert money at the JSON boundary to BigInt cents deterministically. Floats
 * are rejected (REQ-CONTRACTS-008; REQ-CHAIN-006).
 */
export function toBigIntCents(value: number | string): bigint {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(
        `verify: float money rejected at the manifest boundary (${value}) — use integer cents or an integer decimal string`,
      );
    }
    return BigInt(value);
  }
  if (typeof value === "bigint") {
    throw new Error(
      "verify: money at the JSON boundary must be integer cents or an integer decimal string — bigint is not a JSON type; convert with BigInt() after parsing",
    );
  }
  if (typeof value !== "string" || !INTEGER_RE.test(value)) {
    throw new Error(
      `verify: money must be integer cents or an integer decimal string (got ${String(value)})`,
    );
  }
  return BigInt(value);
}

function parseEntryList(
  value: unknown,
  label: string,
  parseEntry: (entry: Record<string, unknown>, index: number) => void,
): void {
  if (!Array.isArray(value)) {
    throw new Error(`verify: manifest.${label} must be an array of entries`);
  }
  if (value.length > MAX_MANIFEST_ENTRIES) {
    throw new Error(
      `verify: manifest.${label} exceeds the bounded limit of ${MAX_MANIFEST_ENTRIES} entries`,
    );
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(
        `verify: manifest.${label}[${index}] must be an object`,
      );
    }
    parseEntry(entry as Record<string, unknown>, index);
  });
}

function parseLedgerEntry(entry: Record<string, unknown>, index: number): void {
  for (const key of Object.keys(entry)) {
    if (
      key !== "account" &&
      key !== "reference" &&
      key !== "debitCents" &&
      key !== "creditCents"
    ) {
      throw new Error(
        `verify: manifest.ledger[${index}] unknown property "${key}" is rejected`,
      );
    }
  }
  const { account, reference, debitCents, creditCents } = entry;
  if (typeof account !== "string" || !REFERENCE_RE.test(account)) {
    throw new Error(
      `verify: manifest.ledger[${index}] account must be 1-256 characters of letters, digits, '.', '_', ':', '/', '-'`,
    );
  }
  if (typeof reference !== "string" || !REFERENCE_RE.test(reference)) {
    throw new Error(
      `verify: manifest.ledger[${index}] reference must be 1-256 characters of letters, digits, '.', '_', ':', '/', '-'`,
    );
  }
  if (
    (typeof debitCents !== "number" && typeof debitCents !== "string") ||
    (typeof creditCents !== "number" && typeof creditCents !== "string")
  ) {
    throw new Error(
      `verify: manifest.ledger[${index}] debitCents/creditCents must be integer cents or an integer decimal string`,
    );
  }
  toBigIntCents(debitCents as number | string);
  toBigIntCents(creditCents as number | string);
}

function parseBankEntry(entry: Record<string, unknown>, index: number): void {
  for (const key of Object.keys(entry)) {
    if (key !== "reference" && key !== "amountCents") {
      throw new Error(
        `verify: manifest.bank[${index}] unknown property "${key}" is rejected`,
      );
    }
  }
  const { reference, amountCents } = entry;
  if (typeof reference !== "string" || !REFERENCE_RE.test(reference)) {
    throw new Error(
      `verify: manifest.bank[${index}] reference must be 1-256 characters of letters, digits, '.', '_', ':', '/', '-'`,
    );
  }
  if (typeof amountCents !== "number" && typeof amountCents !== "string") {
    throw new Error(
      `verify: manifest.bank[${index}].amountCents must be integer cents or an integer decimal string`,
    );
  }
  toBigIntCents(amountCents as number | string);
}

function parseManifestRecord(value: unknown): VerifySourceManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      "verify: the source manifest must be an object with ledger and bank entry lists",
    );
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "ledger" && key !== "bank" && key !== "bankAccount") {
      throw new Error(`verify: manifest unknown property "${key}" is rejected`);
    }
  }
  const bankAccount = record.bankAccount;
  if (
    bankAccount !== undefined &&
    (typeof bankAccount !== "string" || !REFERENCE_RE.test(bankAccount))
  ) {
    throw new Error(
      "verify: bankAccount must be 1-256 characters of letters, digits, '.', '_', ':', '/', '-'",
    );
  }
  const ledger: VerifyLedgerEntry[] = [];
  const bank: VerifyBankEntry[] = [];
  parseEntryList(record.ledger, "ledger", (entry, index) => {
    parseLedgerEntry(entry, index);
    ledger.push(entry as unknown as VerifyLedgerEntry);
  });
  parseEntryList(record.bank, "bank", (entry, index) => {
    parseBankEntry(entry, index);
    bank.push(entry as unknown as VerifyBankEntry);
  });
  return {
    ledger,
    bank,
    ...(bankAccount === undefined ? {} : { bankAccount }),
  };
}

/**
 * Parse a bounded verify input from JSON (the command boundary). Accepts either a
 * bare source manifest or an envelope `{"manifest": {...}, "missionId": "...",
 * "receiptHash": "..."}`. Floats, unknown properties, malformed references, and
 * over-limit entry lists all fail closed.
 */
export function parseVerifyInput(json: string): VerifyChainInput {
  const parsed = parseJsonOrThrow<unknown>(
    json,
    "verify: the source manifest is not valid JSON",
    { includeMessage: true },
  );
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "verify: the source manifest must be an object with ledger and bank entry lists",
    );
  }
  const record = parsed as Record<string, unknown>;
  if (record.manifest !== undefined) {
    // Envelope form.
    for (const key of Object.keys(record)) {
      if (key !== "manifest" && key !== "missionId" && key !== "receiptHash") {
        throw new Error(`verify: unknown envelope property "${key}" is rejected`);
      }
    }
    const missionId = record.missionId;
    if (
      missionId !== undefined &&
      (typeof missionId !== "string" || missionId.length === 0)
    ) {
      throw new Error("verify: missionId must be a non-empty string");
    }
    const receiptHash = record.receiptHash;
    if (
      receiptHash !== undefined &&
      (typeof receiptHash !== "string" || !HEX64.test(receiptHash))
    ) {
      throw new Error(
        "verify: receiptHash must be a 64-character lowercase hex sha-256 digest",
      );
    }
    return {
      manifest: parseManifestRecord(record.manifest),
      ...(missionId === undefined ? {} : { missionId }),
      ...(receiptHash === undefined ? {} : { receiptHash }),
    };
  }
  // Bare manifest form.
  return { manifest: parseManifestRecord(parsed) };
}

/** Check 1: the canonical digest of the source content matches the recorded digest. */
export function checkSourceSnapshotIntegrity(
  manifest: VerifySourceManifest,
  recordedDigest: string,
): VerifyCheckResult {
  let computed: string;
  try {
    computed = sha256Canonical(manifest);
  } catch (error) {
    return {
      check: "source-integrity",
      verdict: "fail",
      detail: `source manifest is not canonicalizable: ${(error as Error).message}`,
    };
  }
  if (computed !== recordedDigest) {
    return {
      check: "source-integrity",
      verdict: "fail",
      detail: `source snapshot digest ${computed} does not match the recorded digest ${recordedDigest} (SC-CHAIN-003)`,
    };
  }
  return {
    check: "source-integrity",
    verdict: "pass",
    detail: "source snapshot digest matches the recorded digest",
  };
}

/** Check 2: every money value normalizes deterministically to BigInt cents. */
export function checkNormalization(
  manifest: VerifySourceManifest,
): VerifyCheckResult {
  try {
    for (const entry of manifest.ledger) {
      toBigIntCents(entry.debitCents);
      toBigIntCents(entry.creditCents);
    }
    for (const entry of manifest.bank) {
      toBigIntCents(entry.amountCents);
    }
  } catch (error) {
    return {
      check: "normalization",
      verdict: "fail",
      detail: `non-integer money in the source manifest: ${(error as Error).message}`,
    };
  }
  return {
    check: "normalization",
    verdict: "pass",
    detail: "all money values normalize deterministically to BigInt cents (no floats)",
  };
}

/** Check 3: total debits equal total credits (double-entry ledger equation). */
export function checkLedgerEquations(
  entries: readonly VerifyLedgerEntry[],
): VerifyCheckResult {
  let debitTotal = 0n;
  let creditTotal = 0n;
  for (const entry of entries) {
    debitTotal += toBigIntCents(entry.debitCents);
    creditTotal += toBigIntCents(entry.creditCents);
  }
  if (debitTotal !== creditTotal) {
    return {
      check: "ledger-equations",
      verdict: "fail",
      detail: `ledger does not balance: total debits ${debitTotal} cents != total credits ${creditTotal} cents`,
    };
  }
  return {
    check: "ledger-equations",
    verdict: "pass",
    detail: `ledger balances: total debits == total credits (${debitTotal} cents)`,
  };
}

/** Check 4: bank statements reconcile with the ledger net amounts per reference. */
export function checkReconciliationCorrectness(
  manifest: VerifySourceManifest,
): VerifyCheckResult {
  const netLedger = new Map<string, bigint>();
  for (const entry of manifest.ledger) {
    if (
      manifest.bankAccount !== undefined &&
      entry.account !== manifest.bankAccount
    ) {
      // Only the bank/cash account legs reconcile against the statements; the
      // contra legs belong to the ledger-equations check.
      continue;
    }
    const current = netLedger.get(entry.reference) ?? 0n;
    netLedger.set(
      entry.reference,
      current + toBigIntCents(entry.debitCents) - toBigIntCents(entry.creditCents),
    );
  }
  const differences: string[] = [];
  for (const bankEntry of manifest.bank) {
    const ledgerNet = netLedger.get(bankEntry.reference) ?? 0n;
    const bankAmount = toBigIntCents(bankEntry.amountCents);
    if (bankAmount !== ledgerNet) {
      differences.push(
        `${bankEntry.reference}: bank ${bankAmount} cents != ledger net ${ledgerNet} cents`,
      );
    }
  }
  for (const [reference, net] of netLedger) {
    if (!manifest.bank.some((entry) => entry.reference === reference)) {
      differences.push(
        `${reference}: ledger net ${net} cents has no bank statement`,
      );
    }
  }
  if (differences.length > 0) {
    return {
      check: "reconciliation-correctness",
      verdict: "fail",
      detail: `reconciliation differences: ${differences.join("; ")}`,
    };
  }
  return {
    check: "reconciliation-correctness",
    verdict: "pass",
    detail: "bank statements reconcile with the ledger net amounts",
  };
}

/** Check 5: the evidence graph recomputes payload hashes and holds its invariants. */
export async function checkGraphIntegrity(
  graph: EvidenceGraphStore,
  missionId: string,
): Promise<VerifyCheckResult> {
  let validation: Awaited<ReturnType<EvidenceGraphStore["validate"]>>;
  try {
    validation = await graph.validate(missionId);
  } catch (error) {
    return {
      check: "graph-integrity",
      verdict: "fail",
      detail: `evidence graph unavailable: ${(error as Error).message}`,
    };
  }
  if (!validation.valid) {
    const detail =
      validation.errors.length > 0
        ? validation.errors.join("; ")
        : "evidence graph integrity validation failed";
    return { check: "graph-integrity", verdict: "fail", detail };
  }
  return {
    check: "graph-integrity",
    verdict: "pass",
    detail: `evidence graph for mission ${missionId} is intact`,
  };
}

/** Check 6: the bound scope recomputes and matches the mission and authorization. */
export async function checkScopeBinding(
  binding: ScopeBinding,
  mission: MissionSnapshot,
  storesRoot: string,
): Promise<VerifyCheckResult> {
  let recomputed: ScopeBinding;
  try {
    recomputed = bindScope(binding.scope);
  } catch (error) {
    return {
      check: "scope-binding",
      verdict: "fail",
      detail: `canonical scope failed to bind: ${(error as Error).message}`,
    };
  }
  if (recomputed.scopeHash !== binding.scopeHash) {
    return {
      check: "scope-binding",
      verdict: "fail",
      detail: "recomputed scope hash does not match the bound scope hash",
    };
  }
  if (
    mission.companyId !== binding.scope.company ||
    mission.fiscalPeriod !== binding.scope.fiscalPeriod
  ) {
    return {
      check: "scope-binding",
      verdict: "fail",
      detail: `mission ${mission.companyId}/${mission.fiscalPeriod} does not match the bound scope ${binding.scope.company}/${binding.scope.fiscalPeriod}`,
    };
  }
  const store = new AuthorityStore(storesRoot);
  const records = await store.listAuthorizations(mission.id);
  const bound = records.some(
    (record) =>
      record.decision === "GRANTED" &&
      record.scopeHash === binding.scopeHash &&
      record.actorId === binding.scope.actor,
  );
  if (!bound) {
    return {
      check: "scope-binding",
      verdict: "fail",
      detail: `no GRANTED authorization bound to scope hash ${binding.scopeHash} for mission ${mission.id}`,
    };
  }
  return {
    check: "scope-binding",
    verdict: "pass",
    detail: `scope hash ${binding.scopeHash} recomputes and matches the mission and a GRANTED authorization`,
  };
}

/** Check 7: the receipt binds to the mission, its proposal evidence, and its digest. */
export function checkReceiptBinding(input: {
  record: HarnessReceiptRecord;
  mission: MissionSnapshot;
}): VerifyCheckResult {
  const { record, mission } = input;
  if (record.receipt.content.missionId !== mission.id) {
    return {
      check: "receipt-binding",
      verdict: "fail",
      detail: `receipt content mission ${record.receipt.content.missionId} does not match mission ${mission.id}`,
    };
  }
  if (record.receipt.content.companyId !== mission.companyId) {
    return {
      check: "receipt-binding",
      verdict: "fail",
      detail: `receipt content company ${record.receipt.content.companyId} does not match mission company ${mission.companyId}`,
    };
  }
  const proposalEvidenceHash = mission.proposal?.evidenceHash;
  if (
    proposalEvidenceHash !== undefined &&
    record.binding.evidenceHash !== proposalEvidenceHash
  ) {
    return {
      check: "receipt-binding",
      verdict: "fail",
      detail: `receipt binding evidence hash ${record.binding.evidenceHash} does not match the mission proposal evidence hash ${proposalEvidenceHash}`,
    };
  }
  if (
    proposalEvidenceHash !== undefined &&
    record.receipt.content.evidenceHash !== proposalEvidenceHash
  ) {
    return {
      check: "receipt-binding",
      verdict: "fail",
      detail: `receipt content evidence hash ${record.receipt.content.evidenceHash} does not match the mission proposal evidence hash ${proposalEvidenceHash}`,
    };
  }
  // The canonical digest of the harness binding is signed through payloadHash
  // (design §3.3; REQ-SCOPE-008): a mismatched digest means a tampered binding.
  if (sha256Canonical(record.binding) !== record.receipt.content.payloadHash) {
    return {
      check: "receipt-binding",
      verdict: "fail",
      detail: "receipt binding digest does not match the signed payload hash — tampered or stale binding",
    };
  }
  return {
    check: "receipt-binding",
    verdict: "pass",
    detail: `receipt ${record.receipt.receiptHash} is bound to mission ${mission.id}, its proposal evidence, and its own binding digest`,
  };
}

/** The source content is mandatory for the computation phases (no ambient lookup). */
function requireManifest(input: VerifyChainInput): VerifySourceManifest {
  if (input.manifest === undefined) {
    throw new VerifyChainBlockedError(EDA_PHASE.INGEST, [
      {
        check: "source-integrity",
        verdict: "fail",
        detail:
          "the bounded source manifest is required for the verify chain (no ambient runtime lookup; REQ-CHAIN-006)",
      },
    ]);
  }
  return input.manifest;
}

/** The bounded per-phase domain computation of the verify chain. */
async function runStep(
  context: ChainStepContext<VerifyChainInput>,
): Promise<ChainStepOutcome<VerifyRunOutput>> {
  const { graph, mission, phase, input, binding } = context;
  const storesRoot = context.stores.root;

  switch (phase) {
    case EDA_PHASE.INGEST: {
      const manifest = requireManifest(input);
      const check = checkSourceSnapshotIntegrity(
        manifest,
        binding.scope.sourceSnapshot,
      );
      if (check.verdict === "fail") {
        throw new VerifyChainBlockedError(phase, [check]);
      }
      return { output: { phase, verdict: "verified", checks: [check] } };
    }
    case EDA_PHASE.NORMALIZE: {
      const manifest = requireManifest(input);
      const check = checkNormalization(manifest);
      if (check.verdict === "fail") {
        throw new VerifyChainBlockedError(phase, [check]);
      }
      return { output: { phase, verdict: "verified", checks: [check] } };
    }
    case EDA_PHASE.CLASSIFY:
      return { output: { phase, verdict: "verified", checks: [] } };
    case EDA_PHASE.RECONCILE: {
      const manifest = requireManifest(input);
      const check = checkLedgerEquations(manifest.ledger);
      if (check.verdict === "fail") {
        throw new VerifyChainBlockedError(phase, [check]);
      }
      return { output: { phase, verdict: "verified", checks: [check] } };
    }
    case EDA_PHASE.INVESTIGATE: {
      const manifest = requireManifest(input);
      const check = checkReconciliationCorrectness(manifest);
      if (check.verdict === "fail") {
        throw new VerifyChainBlockedError(phase, [check]);
      }
      return { output: { phase, verdict: "verified", checks: [check] } };
    }
    case EDA_PHASE.VERIFY: {
      const targetMissionId = input.missionId ?? mission.id;
      const targetMission =
        targetMissionId === mission.id
          ? mission
          : await context.stores.store.findById(targetMissionId);
      if (targetMission === undefined) {
        throw new VerifyChainBlockedError(phase, [
          {
            check: "graph-integrity",
            verdict: "fail",
            detail: `target mission ${targetMissionId} not found`,
          },
        ]);
      }

      const checks: VerifyCheckResult[] = [];
      const graphCheck = await checkGraphIntegrity(graph, targetMissionId);
      checks.push(graphCheck);
      if (graphCheck.verdict === "fail") {
        throw new VerifyChainBlockedError(phase, checks);
      }

      const scopeCheck = await checkScopeBinding(binding, mission, storesRoot);
      checks.push(scopeCheck);
      if (scopeCheck.verdict === "fail") {
        throw new VerifyChainBlockedError(phase, checks);
      }

      const receiptHash = input.receiptHash ?? targetMission.receiptHash;
      if (receiptHash !== null && receiptHash !== undefined) {
        const record = await new ReceiptStore(storesRoot).load(receiptHash);
        if (record === undefined) {
          throw new VerifyChainBlockedError(phase, [
            ...checks,
            {
              check: "receipt-binding",
              verdict: "fail",
              detail: `receipt ${receiptHash} not found in the receipt store`,
            },
          ]);
        }
        const receiptCheck = checkReceiptBinding({
          record,
          mission: targetMission,
        });
        checks.push(receiptCheck);
        if (receiptCheck.verdict === "fail") {
          throw new VerifyChainBlockedError(phase, checks);
        }
      } else {
        checks.push({
          check: "receipt-binding",
          verdict: "pass",
          detail: `no receipt recorded for mission ${targetMissionId} — receipt-binding check not applicable`,
        });
      }
      return { output: { phase, verdict: "verified", checks } };
    }
    default:
      return { output: { phase, verdict: "verified", checks: [] } };
  }
}

/** The verify chain definition (intent `verify`; design §11.4; REQ-CHAIN-003). */
export const verifyChain: ChainDefinition<VerifyChainInput, VerifyRunOutput> = {
  name: "verify",
  intent: "verify",
  requiredMode: AUTHORITY_MODE.ANALYZE,
  // Read-only: the EXECUTE-family ceremony (materiality/approval/receipt) is not
  // applicable — completing the verify mission is a state record, never an
  // accounting mutation (REQ-AUTH-009; SC-CHAIN-003).
  readOnly: true,
  runStep,
};
