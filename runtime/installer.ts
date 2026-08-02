// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Postinstall installer: decides what (if anything) to install and verifies the
// result with the same fail-closed doctor used everywhere else.

import { execFile } from "node:child_process";
import { doctor, type DoctorReport } from "./doctor.js";
import { DEFAULT_PIN, installUrlFor, type RuntimePin } from "./pin.js";

export type InstallDecision =
  | { kind: "pending-release"; notice: string }
  | { kind: "released"; packageName: string; version: string; installUrl: string };

/**
 * Decide what the postinstall must do for a given pin.
 *
 * - pending-release → nothing to install yet: drenyra-ai has not published a
 *   real artifact, so there is no checksum to pin against. The harness keeps
 *   failing closed until the first release flips the pin to "released".
 * - released → install the exact pinned version package-local, then verify.
 */
export function decideInstall(pin: RuntimePin): InstallDecision {
  if (pin.state === "pending-release") {
    return {
      kind: "pending-release",
      notice:
        `drenyra-pi: drenyra-ai@${pin.version} is pinned in "pending-release" state ` +
        "(checksum still \"pending\"). Nothing to install yet — the package-local " +
        "runtime is filled at the first drenyra-ai release, and doctor keeps " +
        "failing closed until then.",
    };
  }
  return {
    kind: "released",
    packageName: pin.package,
    version: pin.version,
    installUrl: installUrlFor(pin),
  };
}

export interface InstallerResult {
  /** 0 = success; 1 = install or verification failed. */
  exitCode: number;
  /** Human-readable outcome to print. */
  message: string;
}

export interface InstallerDeps {
  /** Install the pinned runtime into <packageRoot>/node_modules. */
  install?: (packageRoot: string, installUrl: string) => Promise<void>;
  /** Fail-closed verification of the installed runtime. */
  verify?: (packageRoot: string, pin: RuntimePin) => Promise<DoctorReport>;
}

/**
 * Install the pinned runtime from its release tarball URL (the install source
 * until drenyra-ai publishes to the npm registry). Package-local only —
 * drenyra-pi never trusts an ambient binary.
 */
function runNpmInstall(packageRoot: string, installUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "npm",
      ["install", "--no-save", "--no-package-lock", installUrl],
      { cwd: packageRoot },
      (error, _stdout, stderr) => {
        if (error !== null) {
          const detail = stderr.trim().length > 0 ? stderr.trim() : error.message;
          reject(new Error(detail));
          return;
        }
        resolve();
      },
    );
  });
}

function defaultVerify(packageRoot: string, pin: RuntimePin): Promise<DoctorReport> {
  return doctor({ pin, packageRoot });
}

/**
 * Run the postinstall for a package root.
 *
 * The "released" branch installs the exact pinned version package-local
 * (drenyra-pi never trusts an ambient binary) and then runs the same doctor()
 * used by /drenyra:doctor — the install is only accepted when the verdict is
 * "verified". Until the first real drenyra-ai release this branch is exercised
 * only through test fixtures; the pending-release branch below is live today.
 */
export async function runInstaller(options: {
  pin: RuntimePin;
  packageRoot: string;
  deps?: InstallerDeps;
}): Promise<InstallerResult> {
  const { pin, packageRoot, deps = {} } = options;
  const decision = decideInstall(pin);

  if (decision.kind === "pending-release") {
    return { exitCode: 0, message: decision.notice };
  }

  const install = deps.install ?? runNpmInstall;
  const verify = deps.verify ?? defaultVerify;

  try {
    await install(packageRoot, decision.installUrl);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      message:
        `drenyra-pi: installing ${decision.packageName}@${decision.version} failed: ${detail}`,
    };
  }

  const report = await verify(packageRoot, pin);
  if (report.verdict !== "verified") {
    return {
      exitCode: 1,
      message:
        `drenyra-pi: postinstall verification failed — doctor verdict "${report.verdict}".\n` +
        report.issues.join("\n"),
    };
  }

  return {
    exitCode: 0,
    message:
      `drenyra-pi: ${decision.packageName}@${decision.version} installed and verified ` +
      "package-local.",
  };
}

export { DEFAULT_PIN };
