// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module renders runtime verification status; it holds no money logic.

import { doctor, type DoctorReport } from "./doctor.js";
import type { RuntimePin } from "./pin.js";

export interface RuntimeStatus {
  /** One-line human summary. */
  summary: string;
  /** Multi-line human-readable status. */
  human: string;
  /** Machine-readable report (JSON-serializable, used by startup panel). */
  machine: DoctorReport;
}

export interface StatusInput {
  pin: RuntimePin;
  packageRoot: string;
}

const SUMMARY_BY_VERDICT: Record<DoctorReport["verdict"], string> = {
  verified: "verified — runtime checksum and version match the pin",
  "pending-release":
    "pending-release — the harness fails closed until the first release",
  missing:
    "missing — runtime not found package-local; install under runtime/ or node_modules/, never PATH",
  "version-mismatch":
    "version-mismatch — runtime version does not match the pin, fail closed",
  "checksum-mismatch":
    "checksum-mismatch — runtime checksum does not match the pin, possible tampering, fail closed",
};

/**
 * Human + machine status for the pinned runtime. Reuses doctor() — there is
 * exactly one verification path, so status can never disagree with doctor.
 */
export async function status({ pin, packageRoot }: StatusInput): Promise<RuntimeStatus> {
  const report = await doctor({ pin, packageRoot });
  const label = `${pin.package}@${pin.version}`;
  const summary = `${label}: ${SUMMARY_BY_VERDICT[report.verdict]}`;

  const lines: string[] = [
    `Runtime status: ${report.verdict}`,
    `Pin: ${label} (state: ${report.pinState})`,
  ];
  if (report.resolvedPath !== undefined) {
    lines.push(`Resolved path: ${report.resolvedPath}`);
  } else {
    lines.push("Resolved path: none");
  }
  if (report.version !== undefined) {
    lines.push(`Runtime version: ${report.version} (matches pin: ${report.versionMatches})`);
  } else {
    lines.push("Runtime version: unavailable");
  }
  lines.push(`Checksum matches pin: ${report.checksumMatches}`);
  if (report.issues.length > 0) {
    lines.push("Issues:");
    for (const issue of report.issues) lines.push(`  - ${issue}`);
  }

  return {
    summary,
    human: lines.join("\n"),
    machine: report,
  };
}
