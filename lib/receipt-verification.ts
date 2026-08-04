/**
 * Trusted receipt verification — `verifyHarnessReceipt` (design §6.2). The
 * fixed verification order is:
 *
 *   1. schema (structural conformance to the shipped receipt contract shapes)
 *   2. engine content hash integrity
 *   3. Ed25519 signature authenticity
 *   4. registry lookup and key match (trusted-key registry, fresh read)
 *   5. key lifecycle (current, not expired, not revoked)
 *   6. binding digest (recomputed over the harness `ReceiptBinding`)
 *   7. scope, mission, actor, policy, evidence, and target expectations
 *
 * Unknown key ids return `UNKNOWN_SIGNER` and block. No path falls back to the
 * public key embedded in the receipt — the embedded key proves internal
 * signature consistency only and is never sufficient for fiscal authority
 * (design §15). Verification order short-circuits at the first failing stage.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import {
  verifySignedReceiptTrusted,
  type ReceiptVerificationStatus,
} from "drenyra-ai/receipts";
import { sha256Canonical, type ScopeBinding } from "./canonicalization.js";
import {
  validateHarnessReceiptRecord,
  type HarnessReceiptRecord,
} from "./receipt-store.js";
import type { TrustedKeyRegistry } from "./trusted-key-registry.js";

/** Everything `verifyHarnessReceipt` expects the receipt to be bound to. */
export interface VerifyHarnessReceiptInput {
  record: HarnessReceiptRecord;
  expectedScope: ScopeBinding;
  expectedMissionId: string;
  expectedActorId?: string;
  expectedPolicyVersion?: string;
  expectedTargetHash?: string;
}

/** The structured verification verdict (design §6.2). */
export interface HarnessReceiptVerification {
  valid: boolean;
  engineStatus: ReceiptVerificationStatus;
  bindingValid: boolean;
  scopeValid: boolean;
  targetValid: boolean;
  reasons: string[];
}

/**
 * Verify a harness receipt against the trusted-key registry and the expected
 * scope/mission/actor/policy/target binding. The registry is consulted with a
 * fresh read per verification so revocation takes effect immediately; an empty
 * or unknown registry entry blocks (UNKNOWN_SIGNER).
 */
export async function verifyHarnessReceipt(
  input: VerifyHarnessReceiptInput,
  registry: TrustedKeyRegistry,
): Promise<HarnessReceiptVerification> {
  const reasons: string[] = [];

  // Stage 1: schema (structural conformance to the contract shapes).
  const schema = validateHarnessReceiptRecord(input.record);
  if (!schema.valid) {
    reasons.push(...schema.errors);
    return fail("PAYLOAD_TAMPERED", reasons, "schema");
  }

  const { binding, receipt } = input.record;

  // Stages 2-5: engine content hash, Ed25519 signature, registry key match,
  // and key lifecycle. resolveKey performs a fresh registry read per lookup
  // and never falls back to the receipt's embedded public key.
  const trusted = await verifySignedReceiptTrusted(receipt, (keyId) =>
    registry.resolve(keyId),
  );
  if (trusted.status !== "SIGNER_TRUSTED") {
    reasons.push(describeEngineFailure(trusted.status));
    return fail(trusted.status, reasons, "engine");
  }

  // Stage 6: binding digest — the canonical digest of the harness binding must
  // equal the signed content payloadHash (design §3.3, REQ-SCOPE-008).
  const bindingValid = sha256Canonical(binding) === receipt.content.payloadHash;
  if (!bindingValid) {
    reasons.push("binding digest does not match the signed content payloadHash");
  }

  // Stage 7: scope, mission, actor, policy, evidence, and target expectations.
  const scopeValid =
    binding.scopeHash === input.expectedScope.scopeHash &&
    receipt.content.companyId === input.expectedScope.scope.company;
  if (!scopeValid) {
    reasons.push("binding scope hash or company does not match the expected scope");
  }
  const missionValid = receipt.content.missionId === input.expectedMissionId;
  if (!missionValid) {
    reasons.push("receipt mission id does not match the expected mission");
  }
  const actorValid =
    input.expectedActorId === undefined ||
    receipt.content.actorId === input.expectedActorId;
  if (!actorValid) {
    reasons.push("receipt actor id does not match the expected actor");
  }
  const policyValid =
    input.expectedPolicyVersion === undefined ||
    binding.policyVersion === input.expectedPolicyVersion;
  if (!policyValid) {
    reasons.push("binding policy version does not match the expected policy");
  }
  const evidenceValid = binding.evidenceHash === receipt.content.evidenceHash;
  if (!evidenceValid) {
    reasons.push("binding evidence hash does not match the receipt content evidence hash");
  }
  const targetValid =
    input.expectedTargetHash === undefined || binding.targetHash === input.expectedTargetHash;
  if (!targetValid) {
    reasons.push("binding target hash does not match the expected target");
  }

  return {
    valid:
      bindingValid && scopeValid && missionValid && actorValid && policyValid &&
      evidenceValid && targetValid,
    engineStatus: trusted.status,
    bindingValid,
    scopeValid,
    targetValid,
    reasons,
  };
}

function fail(
  engineStatus: ReceiptVerificationStatus,
  reasons: string[],
  stage: string,
): HarnessReceiptVerification {
  return {
    valid: false,
    engineStatus,
    bindingValid: false,
    scopeValid: false,
    targetValid: false,
    reasons: [...reasons, `${stage} stage failed — verification stops`],
  };
}

function describeEngineFailure(status: ReceiptVerificationStatus): string {
  switch (status) {
    case "PAYLOAD_TAMPERED":
      return "receipt content does not match its asserted hash (PAYLOAD_TAMPERED)";
    case "CONTENT_VALID":
      return "receipt signature is invalid (CONTENT_VALID)";
    case "UNKNOWN_SIGNER":
      return "signer is not a trusted key in the registry (UNKNOWN_SIGNER)";
    case "KEY_EXPIRED":
      return "trusted key is expired or not yet issued (KEY_EXPIRED)";
    case "KEY_REVOKED":
      return "trusted key is revoked (KEY_REVOKED)";
    default:
      return `engine verification failed (${status})`;
  }
}
