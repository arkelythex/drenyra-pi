/**
 * Deterministic 18-cell route selector (pi-sdd-030-routing-adapter; design D3
 * §5). `selectRoutingRoute(input)` is a TOTAL pure function over two risk
 * bands × three evidence states × three reversibility values. The kernel tier
 * (R0..R3) is normalized internally to a risk band; a missing value, a value
 * outside the closed domains, or a declared tier conflicting with the kernel
 * tier returns `AMBIGUOUS_INPUT` before indexing the table. Insufficient
 * evidence returns `MISSING_EVIDENCE` with the already-validated required
 * hashes. The result is a proposal `{ route, basis }` carrying NO authorization
 * and NO transition: Core gates every transition (REQ-ROUTE-001).
 *
 * The table is advisory and exhaustive; incomplete or contradictory
 * classification never defaults to a route (REQ-ROUTE-002, SC-ROUTE-004).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import type {
  RiskBand,
  RouteSelection,
  RouteSelectionInput,
  RoutingReversibility,
} from "./types.js";

const TIERS = new Set(["R0", "R1", "R2", "R3"]);
const EVIDENCE_STATES = new Set(["SUFFICIENT", "INSUFFICIENT", "AMBIGUOUS"]);
const REVERSIBILITIES = new Set([
  "REVERSIBLE",
  "PARTIALLY_REVERSIBLE",
  "IRREVERSIBLE",
]);

/** The one route for a SUFFICIENT cell (design §5 table). */
function routeFor(
  band: RiskBand,
  reversibility: RoutingReversibility,
): "direct" | "delegated" | "durable" {
  if (band === "R0_R1") {
    return reversibility === "REVERSIBLE" ? "direct" : "delegated";
  }
  return reversibility === "REVERSIBLE" ? "delegated" : "durable";
}

/**
 * Total pure route selection over the 18 normalized cells. The output is a
 * proposal only: it grants no authority and carries no transition.
 */
export function selectRoutingRoute(
  input: RouteSelectionInput,
): RouteSelection {
  const tier = input.kernelRiskTier;
  if (typeof tier !== "string" || !TIERS.has(tier)) {
    return { ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: ["kernelRiskTier"] } };
  }
  if (
    input.declaredRiskTier !== undefined &&
    (typeof input.declaredRiskTier !== "string" || input.declaredRiskTier !== tier)
  ) {
    return { ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: ["declaredRiskTier"] } };
  }
  const evidence = input.evidenceSufficiency;
  if (typeof evidence !== "string" || !EVIDENCE_STATES.has(evidence)) {
    return { ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: ["evidenceSufficiency"] } };
  }
  const reversibility = input.reversibility;
  if (typeof reversibility !== "string" || !REVERSIBILITIES.has(reversibility)) {
    return { ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: ["reversibility"] } };
  }

  if (evidence === "INSUFFICIENT") {
    return {
      ok: false,
      reason: {
        kind: "MISSING_EVIDENCE",
        requiredHashes: [...input.requiredEvidenceHashes],
      },
    };
  }
  if (evidence === "AMBIGUOUS") {
    return { ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: ["evidenceSufficiency"] } };
  }

  let band: RiskBand;
  if (tier === "R0" || tier === "R1") {
    band = "R0_R1";
  } else {
    band = "R2_R3";
  }
  return {
    ok: true,
    route: routeFor(band, reversibility as RoutingReversibility),
    basis: {
      kernelRiskTier: tier as RouteSelectionInput["kernelRiskTier"],
      evidenceSufficiency: evidence as RouteSelectionInput["evidenceSufficiency"],
      reversibility: reversibility as RoutingReversibility,
    },
  };
}
