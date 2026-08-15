// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module is the Pi boundary over the Core configurator library; it holds
// no money logic and no fiscal authority.
//
// drenyra-pi configurator host integration (SDD-020 slice 2).
//
// Pi consumes the Core configurator library (`drenyra-ai/configurator`,
// public since drenyra-ai@0.4.1) — no deterministic composition logic is
// duplicated here (REQ-BOUND-001). This module owns only the Pi boundary:
// the drenyra-pi host identity, the typed fail-closed outcomes, and the
// fresh-home bootstrap that composes Core primitives (the Core's own
// `cmd/install` bootstrap flow is deliberately not part of the public
// configurator subpath, so the same primitive composition is wired here,
// scoped to the drenyra-pi host only).
//
// Scope boundary: the configurator manages harness-level agent-host
// composition under `<home>/.drenyra`. It has no fiscal authority — no
// monetary value is read, written, or computed and no authorization decision
// is made; managed composition is not mission/scope-bound.
//
// Fail-closed contract: a missing/invalid home, an unreadable manifest, or a
// `ManagedConfigError` NEVER throws to the caller — every path returns the
// typed result. Non-`ManagedConfigError` failures (for example an IO error
// while bootstrapping over a path that is not a directory) map to
// `MANAGED_STATE_UNKNOWN`, the only honest code for "managed state could not
// be established".

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSET_FILENAMES,
  COMPOSITION_SCHEMA_VERSION,
  ManagedConfigError,
  commitTransition,
  hashManagedAsset,
  managedHostPin,
  managedManifestPath,
  planUpgrade,
  readManagedState,
  reDeriveHostConfigDir,
  renderManagedMarker,
  renderManagedSkills,
  renderPinnedAiRuntime,
  runConfigDiagnostics,
  type AssetResult,
  type ConfigDiagnostic,
  type InstallManifest,
  type ManagedConfigErrorCode,
} from "drenyra-ai/configurator";

/** Home resolution is Core-owned: `--home` wins, else `$HOME`/cwd. */
export { homeFromArgs } from "drenyra-ai/configurator";

export const CONFIGURATOR_TRANSITION_STATUS = {
  UPGRADED: "upgraded",
  UNCHANGED: "unchanged",
} as const;

export type ConfiguratorTransitionStatus =
  (typeof CONFIGURATOR_TRANSITION_STATUS)[keyof typeof CONFIGURATOR_TRANSITION_STATUS];

/** Fail-closed reason for a configurator doctor failure. */
export interface ConfiguratorDoctorFailureReason {
  kind: "MANAGED_STATE_UNKNOWN";
  message: string;
}

/** Fail-closed reason for an install/sync transition failure. */
export interface ConfiguratorTransitionFailureReason {
  kind: ManagedConfigErrorCode;
  message: string;
}

export interface ConfiguratorDoctorOk {
  ok: true;
  diagnostics: ConfigDiagnostic[];
}

export interface ConfiguratorDoctorFailed {
  ok: false;
  reason: ConfiguratorDoctorFailureReason;
}

/**
 * The configurator doctor report. `ok: true` means the Core produced its
 * diagnostics (each diagnostic carries its own ok flag); `ok: false` only
 * when the Core threw — the wrapper never throws to the caller.
 */
export type ConfiguratorDoctorReport = ConfiguratorDoctorOk | ConfiguratorDoctorFailed;

export interface ConfiguratorTransitionOk {
  ok: true;
  status: ConfiguratorTransitionStatus;
  from: string;
  to: string;
  results: AssetResult[];
  manifestPath: string;
}

export interface ConfiguratorTransitionFailed {
  ok: false;
  reason: ConfiguratorTransitionFailureReason;
}

/** Install/sync outcome; every path is typed, never a throw. */
export type ConfiguratorTransitionOutcome =
  | ConfiguratorTransitionOk
  | ConfiguratorTransitionFailed;

/**
 * The drenyra-pi host config directory: `<home>/.drenyra` (Core HOST_DIR_MAP).
 */
export function drenyraPiHostConfigDir(homeDir: string): string {
  return reDeriveHostConfigDir(homeDir, "drenyra-pi");
}

/**
 * Read-only configurator doctor for one home (managed composition + per-host
 * pin diagnostics). Never writes. Fail-closed: any thrown error becomes the
 * typed `ok: false` report.
 */
export function runConfiguratorDoctor(
  homeDir: string,
  packagedVersion: string,
): ConfiguratorDoctorReport {
  try {
    return { ok: true, diagnostics: runConfigDiagnostics(homeDir, packagedVersion) };
  } catch (error) {
    return {
      ok: false,
      reason: {
        kind: "MANAGED_STATE_UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Install the drenyra-pi managed composition + pin asset under
 * `<home>/.drenyra`. Idempotent: a current-schema home at the packaged
 * version reports `unchanged` with zero writes.
 */
export function runConfiguratorInstall(
  homeDir: string,
  packagedVersion: string,
): ConfiguratorTransitionOutcome {
  return runManagedTransition(homeDir, packagedVersion);
}

/**
 * Synchronize the drenyra-pi managed composition with the packaged version.
 * Shares the install transition engine (per SDD-020): absent state
 * bootstraps, current state reports `unchanged` with zero writes.
 */
export function runConfiguratorSync(
  homeDir: string,
  packagedVersion: string,
): ConfiguratorTransitionOutcome {
  return runManagedTransition(homeDir, packagedVersion);
}

/**
 * The shared read → plan → commit engine (Core-owned determinism):
 *   - invalid manifest            → fail closed `MANAGED_STATE_UNKNOWN`;
 *   - absent manifest             → fresh-home bootstrap (Core primitives);
 *   - current/legacy manifest     → `planUpgrade` (idempotent), commit only
 *                                   when the plan is not `unchanged`.
 */
function runManagedTransition(
  homeDir: string,
  packagedVersion: string,
): ConfiguratorTransitionOutcome {
  try {
    const state = readManagedState(homeDir);
    if (state.state === "invalid") {
      return transitionFailure({
        kind: "MANAGED_STATE_UNKNOWN",
        message: `managed manifest invalid: ${state.invalidReason ?? "unknown"}`,
      });
    }
    if (state.state === "absent") {
      return bootstrapDrenyraPiComposition(homeDir, packagedVersion);
    }
    const plan = planUpgrade(homeDir, packagedVersion, packagedVersion);
    const status: ConfiguratorTransitionStatus =
      plan.status === CONFIGURATOR_TRANSITION_STATUS.UNCHANGED
        ? CONFIGURATOR_TRANSITION_STATUS.UNCHANGED
        : CONFIGURATOR_TRANSITION_STATUS.UPGRADED;
    if (plan.status !== CONFIGURATOR_TRANSITION_STATUS.UNCHANGED) {
      commitTransition(homeDir, plan);
    }
    return {
      ok: true,
      status,
      from: plan.from,
      to: plan.to,
      results: plan.results,
      manifestPath: managedManifestPath(homeDir),
    };
  } catch (error) {
    return transitionFailure(toTransitionReason(error));
  }
}

/**
 * Fresh-home bootstrap, mirroring the Core's `cmd/install` flow but scoped to
 * the drenyra-pi host (the host config dir IS the managed dir). All asset
 * rendering, hashing, pin bytes, paths, and the manifest schema come from the
 * Core; only the wiring lives here (REQ-BOUND-001). Managed files are created
 * only when absent — foreign bytes are preserved, never overwritten. The
 * manifest is written last (the composition authority never publishes alone).
 */
function bootstrapDrenyraPiComposition(
  homeDir: string,
  packagedVersion: string,
): ConfiguratorTransitionOutcome {
  const configDir = reDeriveHostConfigDir(homeDir, "drenyra-pi");
  const activatedAt = new Date().toISOString();
  const markerContent = renderManagedMarker(activatedAt);
  const skillsContent = renderManagedSkills();
  const pinBytes = renderPinnedAiRuntime("drenyra-pi");
  const results: AssetResult[] = [];

  mkdirSync(configDir, { recursive: true });

  const pinPath = join(configDir, ASSET_FILENAMES.pin);
  if (existsSync(pinPath)) {
    results.push({ host: "drenyra-pi", asset: "pin", action: "preserved" });
  } else {
    writeFileSync(pinPath, pinBytes);
    results.push({ host: "drenyra-pi", asset: "pin", action: "created" });
  }

  const assets: ReadonlyArray<{ asset: "marker" | "skills"; content: string }> = [
    { asset: "marker", content: markerContent },
    { asset: "skills", content: skillsContent },
  ];
  for (const { asset, content } of assets) {
    const assetPath = join(configDir, ASSET_FILENAMES[asset]);
    if (existsSync(assetPath)) {
      results.push({ host: "drenyra-pi", asset, action: "preserved" });
    } else {
      writeFileSync(assetPath, content);
      results.push({ host: "drenyra-pi", asset, action: "created" });
    }
  }

  const manifest: InstallManifest = {
    manager: "drenyra-ai",
    version: packagedVersion,
    installedAt: activatedAt,
    hosts: [{ name: "drenyra-pi", configDir, present: true }],
    assets: ["skills"],
    composition: {
      schemaVersion: COMPOSITION_SCHEMA_VERSION,
      current: {
        packageVersion: packagedVersion,
        sequence: 0,
        activatedAt,
        managedAssets: {
          marker: hashManagedAsset(markerContent),
          skills: hashManagedAsset(skillsContent),
        },
        pinnedComposition: { "drenyra-pi": managedHostPin("drenyra-pi") },
      },
      previous: null,
    },
  };
  const manifestPath = managedManifestPath(homeDir);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    ok: true,
    status: CONFIGURATOR_TRANSITION_STATUS.UPGRADED,
    from: "absent",
    to: packagedVersion,
    results,
    manifestPath,
  };
}

function toTransitionReason(
  error: unknown,
): ConfiguratorTransitionFailureReason {
  if (error instanceof ManagedConfigError) {
    return { kind: error.code, message: error.message };
  }
  return {
    kind: "MANAGED_STATE_UNKNOWN",
    message: error instanceof Error ? error.message : String(error),
  };
}

function transitionFailure(
  reason: ConfiguratorTransitionFailureReason,
): ConfiguratorTransitionOutcome {
  return { ok: false, reason };
}
