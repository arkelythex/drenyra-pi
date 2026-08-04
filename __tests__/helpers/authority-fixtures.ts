/**
 * Test fixtures for authority gates, authority store, and accounting status.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers. `sourceSnapshot` is a sha-256 digest
 * of the frozen source manifest, never a path.
 */

import {
  AccountingMissionStatus,
  type MissionSnapshot,
  type MissionStep,
} from "drenyra-ai/missions";
import {
  buildSignedReceipt,
  generateReceiptKeyPair,
  type ReceiptContent,
  type SignedReceipt,
  type SigningKeyInfo,
} from "drenyra-ai/receipts";
import { AUTHORITY_MODE, type AuthorityMode, type CanonicalScope } from "../../runtime/context.js";
import { bindScope, type ScopeBinding } from "../../lib/canonicalization.js";
import type { AuthorizationRecord } from "../../lib/authority-gates.js";

/** A valid 11-digit RUC with a valid check digit (Módulo 11). */
export const FIXTURE_RUC = "20123456786";
export const FIXTURE_PERIOD = "202507";
export const FIXTURE_SNAPSHOT_DIGEST = "a".repeat(64);

/** A complete 10-element canonical scope; every element valid. */
export function makeCanonicalScope(
  overrides: Partial<CanonicalScope> = {},
): CanonicalScope {
  return {
    tenant: "acme",
    organization: "acme-accounting",
    company: FIXTURE_RUC,
    fiscalPeriod: FIXTURE_PERIOD,
    ledgerBook: "general-ledger",
    operationType: "monthly-close",
    sourceSnapshot: FIXTURE_SNAPSHOT_DIGEST,
    policyVersion: "policies.v1",
    actor: "alice",
    authorityLevel: AUTHORITY_MODE.EXECUTE,
    ...overrides,
  };
}

/** Bind a canonical scope (with optional element overrides) to a stable binding. */
export function makeScopeBinding(
  scopeOverrides: Partial<CanonicalScope> = {},
): ScopeBinding {
  return bindScope(makeCanonicalScope(scopeOverrides));
}

/** A GRANTED authorization record bound to a scope binding. */
export function makeAuthorization(
  overrides: Partial<AuthorizationRecord> = {},
  binding?: ScopeBinding,
): AuthorizationRecord {
  const bound = binding ?? makeScopeBinding();
  return {
    id: "auth-001",
    missionId: "mission-close-001",
    scopeHash: bound.scopeHash,
    authorityMode: bound.scope.authorityLevel as AuthorityMode,
    actionFamily: "EXECUTE_TARGET",
    actorId: bound.scope.actor,
    decision: "GRANTED",
    issuedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A mission snapshot aligned with the fixture scope. */
export function makeMission(
  overrides: Partial<MissionSnapshot> = {},
  steps: MissionStep[] = [],
): MissionSnapshot {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    id: "mission-close-001",
    companyId: FIXTURE_RUC,
    fiscalPeriod: FIXTURE_PERIOD,
    intent: "monthly-close",
    status: AccountingMissionStatus.RUNNING,
    version: 1,
    progress: 0,
    steps,
    currentStep: "",
    blockers: [],
    proposal: null,
    rejection: null,
    receiptId: null,
    receiptHash: null,
    lastEventSequence: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export interface ApprovalReceiptFixture {
  receipt: SignedReceipt;
  key: SigningKeyInfo;
}

/**
 * An engine-signed approval receipt plus its trusted-key metadata. The key is
 * issued in the past, has no expiry or revocation, and is therefore "current"
 * under the engine lifecycle check.
 */
export function makeApprovalReceipt(
  overrides: Partial<ReceiptContent> = {},
): ApprovalReceiptFixture {
  const keyPair = generateReceiptKeyPair("signer-trust-001");
  const receipt = buildSignedReceipt(
    {
      missionId: "mission-close-001",
      companyId: FIXTURE_RUC,
      actorId: "alice",
      decision: "APPROVE",
      proposalVersion: 1,
      evidenceHash: "b".repeat(64),
      previousStatus: AccountingMissionStatus.AWAITING_APPROVAL,
      newStatus: AccountingMissionStatus.APPROVED,
      payloadHash: "c".repeat(64),
      timestamp: "2026-07-01T00:00:00.000Z",
      ...overrides,
    },
    keyPair,
  );
  const key: SigningKeyInfo = {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    issuedAt: "2026-01-01T00:00:00.000Z",
  };
  return { receipt, key };
}
