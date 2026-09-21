// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Postinstall installer: decides what (if anything) to install and verifies the
// result with the same fail-closed doctor used everywhere else.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { doctor, type DoctorReport } from "./doctor.js";
import { DEFAULT_PIN, installUrlFor, type RuntimePin } from "./pin.js";

export type InstallDecision =
  | { kind: "pending-release"; notice: string }
  | {
      kind: "released";
      packageName: string;
      version: string;
      installUrl: string;
    };

/**
 * Relative path of the vendored tarball inside the package tree, when the
 * package ships one. The vendored artifact is the PREFERRED install source
 * (keeps installs offline and private-repo independent); the release URL
 * remains the fallback for builds published without a vendored artifact.
 */
export function vendoredTarballFor(pin: RuntimePin): string {
  return join("vendored", `${pin.package}-${pin.version}.tgz`);
}

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
        `drenyra-shell: drenyra-ai@${pin.version} is pinned in "pending-release" state ` +
        '(checksum still "pending"). Nothing to install yet — the package-local ' +
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
  install?: (packageRoot: string, installSource: string) => Promise<void>;
  /** Fail-closed verification of the installed runtime. */
  verify?: (packageRoot: string, pin: RuntimePin) => Promise<DoctorReport>;
}

/**
 * Install the pinned runtime from its release tarball URL (the install source
 * until drenyra-ai publishes to the npm registry). Package-local only —
 * drenyra-shell never trusts an ambient binary.
 */
function runNpmInstall(packageRoot: string, installUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "npm",
      // --legacy-peer-deps is load-bearing. The nested install runs with cwd
      // inside the installed package, so npm reads THIS package's published
      // manifest and walks its devDependency tree (vitest and friends).
      // npm 10.9.x crashes there in Arborist #loadPeerSet with "Cannot read
      // properties of null (reading 'edgesOut')", failing the whole
      // postinstall. Skipping peer resolution avoids that code path
      // entirely; the pinned runtime's own integrity is proved separately by
      // doctor(), which fails closed.
      //
      // Do NOT add --omit=dev: the pinned runtime is declared in
      // devDependencies, so omitting dev deps drops the very package this
      // install exists to place, and doctor then correctly reports it missing.
      [
        "install",
        "--no-save",
        "--no-package-lock",
        "--legacy-peer-deps",
        installUrl,
      ],
      { cwd: packageRoot },
      (error, _stdout, stderr) => {
        if (error !== null) {
          const detail =
            stderr.trim().length > 0 ? stderr.trim() : error.message;
          reject(new Error(detail));
          return;
        }
        resolve();
      },
    );
  });
}

function defaultVerify(
  packageRoot: string,
  pin: RuntimePin,
): Promise<DoctorReport> {
  return doctor({ pin, packageRoot });
}

/**
 * Run the postinstall for a package root.
 *
 * The "released" branch installs the exact pinned version package-local
 * (drenyra-shell never trusts an ambient binary) and then runs the same doctor()
 * used by /drenyra:doctor — the install is only accepted when the verdict is
 * "verified". The released path is the one in force: `DEFAULT_PIN.state` is
 * "released" in `runtime/pin.ts`, with the entry-artifact checksum pinned, so
 * this function installs the pinned runtime for real. The pending-release branch
 * below is a retained fallback for a pin with no published artifact — its notice
 * is covered by tests — and it is not the live path.
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

  const vendoredPath = join(packageRoot, vendoredTarballFor(pin));
  const installSource =
    decision.kind === "released" && existsSync(vendoredPath)
      ? vendoredPath
      : decision.installUrl;

  try {
    await install(packageRoot, installSource);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      message: `drenyra-shell: installing ${decision.packageName}@${decision.version} failed: ${detail}`,
    };
  }

  const report = await verify(packageRoot, pin);
  if (report.verdict !== "verified") {
    return {
      exitCode: 1,
      message:
        `drenyra-shell: postinstall verification failed — doctor verdict "${report.verdict}".\n` +
        report.issues.join("\n"),
    };
  }

  return {
    exitCode: 0,
    message:
      `drenyra-shell: ${decision.packageName}@${decision.version} installed and verified ` +
      "package-local.",
  };
}

export { DEFAULT_PIN };
