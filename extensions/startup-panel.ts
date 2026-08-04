/**
 * Startup panel — the activation-time status banner (design §10.2; T-S4A-003).
 *
 * On activation the extension prints one concise banner through an injected
 * output function: the pinned-runtime verdict (via the fail-closed doctor) and
 * the default context's canonical scope completeness. A banner failure renders
 * degraded status and grants no mission capability.
 *
 * The verified local Pi ExtensionAPI slice exposes `registerCommand` and
 * command-time `cwd` only; it does not establish a safe `ctx.ui` activation
 * surface. This design therefore does NOT add an unverified UI dependency:
 * the banner degrades to a printed line. A future verified host adapter may
 * supply rich rendering; command behavior never depends on it.
 *
 * Fiscal convention: digests are lowercase hex sha-256; version/sequence
 * numbers are JSON integers.
 */

import type { CanonicalScopeElement, ScopeContextStore } from "../runtime/context.js";
import { loadCanonicalScope } from "../runtime/context.js";
import { doctor, type DoctorVerdict } from "../runtime/doctor.js";
import { DEFAULT_PIN } from "../runtime/pin.js";

/** Dependency slice for the activation banner (design §10.2). */
export interface StartupPanelDeps {
  writeLine(line: string): void;
  packageRoot: string;
  contextStore: ScopeContextStore;
}

/** The banner result (degraded status grants no mission capability). */
export interface StartupPanelResult {
  /** True when the runtime is unverified or the banner itself failed. */
  degraded: boolean;
  /** The doctor verdict, or "banner-failed" when the sink threw. */
  runtimeVerdict: DoctorVerdict | "banner-failed";
  scopeComplete: boolean;
  missing: readonly CanonicalScopeElement[];
  /** Always false while degraded; the panel never grants capability. */
  capabilityGranted: boolean;
}

/**
 * Print the activation banner. Never throws: a failing banner sink, doctor
 * failure, or unverified runtime degrades the status and grants no mission
 * capability (design §10.2).
 */
export async function showStartupPanel(deps: StartupPanelDeps): Promise<StartupPanelResult> {
  let report;
  try {
    report = await doctor({ pin: DEFAULT_PIN, packageRoot: deps.packageRoot });
  } catch (error) {
    safeWrite(
      deps,
      `drenyra-pi degraded · runtime banner-failed (${error instanceof Error ? error.message : String(error)}) · no mission capability`,
    );
    return {
      degraded: true,
      runtimeVerdict: "banner-failed",
      scopeComplete: false,
      missing: [],
      capabilityGranted: false,
    };
  }

  const scopeReport = loadCanonicalScope(deps.contextStore.load());
  const scopeText = scopeReport.complete
    ? "complete"
    : `incomplete (missing: ${scopeReport.missing.join(", ")})`;
  const bannerWritten = safeWrite(
    deps,
    `drenyra-pi ${DEFAULT_PIN.package}@${DEFAULT_PIN.version} · runtime ${report.verdict} · scope ${scopeText}`,
  );
  if (!bannerWritten) {
    return {
      degraded: true,
      runtimeVerdict: "banner-failed",
      scopeComplete: scopeReport.complete,
      missing: scopeReport.missing,
      capabilityGranted: false,
    };
  }

  const degraded = report.verdict !== "verified";
  if (degraded) {
    safeWrite(deps, "drenyra-pi: runtime not verified — fiscal operations fail closed.");
  }
  return {
    degraded,
    runtimeVerdict: report.verdict,
    scopeComplete: scopeReport.complete,
    missing: scopeReport.missing,
    capabilityGranted: !degraded,
  };
}

/** Emit one banner line; a failing sink returns false (degraded, never throws). */
function safeWrite(deps: StartupPanelDeps, line: string): boolean {
  try {
    deps.writeLine(line);
    return true;
  } catch {
    return false;
  }
}
