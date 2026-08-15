/**
 * Shared bounded monthly-close fixture for the two-host replacement harness
 * (pi-sdd-040-adapter-boundary, WU2; design §4.3).
 *
 * Plain constants and types ONLY: this module imports no Pi production module
 * and no drenyra-ai module, so it can never introduce a circular host
 * dependency. The exported value is deeply frozen; consumers receive a fresh
 * clone of the same frozen logical value.
 *
 * The fixture contains NO precomputed gate verdicts, NO precomputed materiality
 * tier, and NO receipt — those must be produced through the pinned kernel.
 * `scope.sourceSnapshot` is the lowercase hex sha-256 of the frozen
 * `manifest` (computed with the canonical sorted-key payload serialization; the
 * harness test re-derives and asserts the equality).
 *
 * Fiscal convention: monetary values are BigInt cents; no float is ever used.
 */

export interface RdaReplacementScope {
  tenant: string;
  organization: string;
  company: string; // valid 11-digit RUC (check digit Módulo 11)
  fiscalPeriod: string; // canonical YYYYMM
  ledgerBook: string;
  operationType: "monthly-close";
  sourceSnapshot: string; // lowercase hex sha-256 of the frozen manifest
  policyVersion: string;
  actor: string;
  authorityLevel: "EXECUTE";
}

export interface RdaReplacementEvidence {
  id: string;
  kind: string;
  reference: string;
  amountCents: bigint;
}

export interface RdaReplacementMateriality {
  input: {
    value: bigint;
    reversibility: "reversible" | "partially-reversible" | "irreversible";
    jurisdiction: string;
  };
  minimum: "R2";
}

export interface RdaReplacementFixture {
  scope: RdaReplacementScope;
  /** The frozen source manifest the scope `sourceSnapshot` hashes. */
  manifest: Readonly<Record<string, unknown>>;
  evidence: readonly RdaReplacementEvidence[];
  materiality: RdaReplacementMateriality;
  humanApproval: { approverId: string; reason: string };
  target: {
    operation: "monthly-close";
    content: Readonly<Record<string, unknown>>;
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

const FIXTURE = deepFreeze({
  scope: {
    tenant: "acme",
    organization: "acme-accounting",
    company: "20123456786",
    fiscalPeriod: "202507",
    ledgerBook: "general-ledger",
    operationType: "monthly-close",
    // Lowercase hex sha-256 of `manifest` below (canonical sorted-key payload
    // serialization). Re-derived and asserted by the harness test.
    sourceSnapshot: "0384422a997ab448adf2bcd2846c5d7877c72ad5de003f0b4a52a2f7d181430b",
    policyVersion: "policies.v1",
    actor: "alice",
    authorityLevel: "EXECUTE",
  },
  manifest: {
    ledger: [
      { account: "101", reference: "B001", debitCents: 1_000_000, creditCents: 0 },
      { account: "401", reference: "B001", debitCents: 0, creditCents: 1_000_000 },
      { account: "101", reference: "B002", debitCents: 250_000, creditCents: 0 },
      { account: "401", reference: "B002", debitCents: 0, creditCents: 250_000 },
    ],
    bank: [
      { reference: "B001", amountCents: 1_000_000 },
      { reference: "B002", amountCents: 250_000 },
    ],
    bankAccount: "101",
  },
  evidence: [
    { id: "src-balance", kind: "balance-snapshot", reference: "BAL-202507", amountCents: 1_000_000n },
    { id: "src-mayor", kind: "mayor-snapshot", reference: "MAY-202507", amountCents: 600_000n },
    { id: "src-auxiliaries", kind: "auxiliaries-snapshot", reference: "AUX-202507", amountCents: 400_000n },
    { id: "src-bank", kind: "bank-movements", reference: "BNK-202507", amountCents: 250_000n },
  ],
  materiality: {
    // Kernel R1, floored to R2 by the declared minimum — exercises the floor
    // without triggering the R3 dual-approval rule.
    input: {
      value: 1_000_00n,
      reversibility: "reversible",
      jurisdiction: "PE",
    },
    minimum: "R2",
  },
  humanApproval: {
    approverId: "contador-01",
    reason: "monthly close (bounded harness)",
  },
  target: {
    operation: "monthly-close",
    content: {
      chain: "monthly-close",
      phase: "close",
      note: "bounded harness close",
    },
  },
}) satisfies RdaReplacementFixture;

/**
 * A fresh clone of the same frozen logical value. Consumers (the Pi branch and
 * the substitute host) each receive their own structurally identical value.
 */
export function createRdaReplacementFixture(): RdaReplacementFixture {
  return deepFreeze(structuredClone(FIXTURE));
}
