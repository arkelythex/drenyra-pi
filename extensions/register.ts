// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module registers the Drenyra Pi extension; it holds no money logic.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { doctor } from "../runtime/doctor.js";
import { DEFAULT_PIN } from "../runtime/pin.js";
import { status } from "../runtime/status.js";

/**
 * Drenyra Pi package version. Keep in sync with package.json — the pin's
 * version is the Drenyra AI runtime version, this is the harness version.
 */
const DRENYRA_PI_VERSION = "0.0.1-prealpha.1";

/**
 * Pi extension registration model (verified against the installed gentle-pi):
 *
 * - gentle-pi package.json declares `"pi": { "extensions": ["./extensions"] }` —
 *   a directory whose `.ts` files are extension entrypoints.
 * - Each entrypoint default-exports an `ExtensionFactory`:
 *   `(pi: ExtensionAPI) => void | Promise<void>`.
 * - Commands register through `pi.registerCommand(name, options)` where
 *   options omit `name`/`sourceInfo` and the handler is
 *   `(args: string, ctx: ExtensionCommandContext) => Promise<void>`.
 *
 * Sources read:
 *   /home/dreamcoder08/.pi/agent/npm/node_modules/gentle-pi/package.json
 *   /home/dreamcoder08/.pi/agent/npm/node_modules/gentle-pi/extensions/*.ts
 *   @earendil-works/pi-coding-agent@0.74.2 (ExtensionFactory, ExtensionAPI,
 *   RegisteredCommand type definitions).
 * Note: gentle-pi's docs/ has no extensions.md; the model was read from the
 * package manifest, the shipped extensions, and the pi-coding-agent types.
 *
 * Drenyra Pi must stay zero-runtime-dependency, so instead of importing
 * `ExtensionAPI` from `@earendil-works/pi-coding-agent` this module declares
 * the minimal structural slice it consumes; a real ExtensionAPI satisfies it.
 */

/** Structural slice of `ExtensionAPI.registerCommand` used by this extension. */
export interface PiExtensionApi {
  registerCommand(
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: PiCommandContext) => Promise<void>;
    },
  ): void;
}

/** Structural slice of `ExtensionCommandContext` consumed by handlers. */
export interface PiCommandContext {
  /** Pi working directory at command invocation time. */
  cwd: string;
}

/** The installed package root: <package>/extensions/register.ts → <package>. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export interface DrenyraPiExtensionDescriptor {
  name: string;
  version: string;
  /** Capabilities provided by this extension, as consumed by the startup panel. */
  provides: readonly string[];
  /** Commands registered on activation. */
  commands: readonly string[];
  /** The pinned Drenyra AI runtime this extension verifies. */
  runtime: {
    package: string;
    version: string;
    state: "released" | "pending-release";
  };
}

/**
 * Typed registration descriptor for the drenyra-pi extension, matching the
 * gentle-pi `pi` manifest / factory model. `provides` mirrors the capabilities
 * table in contracts/package-contract.md; the runtime block mirrors
 * contracts/runtime-dependency.md.
 */
export const drenyraPiExtension = {
  name: "drenyra-pi",
  version: DRENYRA_PI_VERSION,
  provides: ["status", "doctor"] as const,
  commands: ["/drenyra:status", "/drenyra:doctor"] as const,
  runtime: {
    package: DEFAULT_PIN.package,
    version: DEFAULT_PIN.version,
    state: DEFAULT_PIN.state,
  },
} as const satisfies DrenyraPiExtensionDescriptor;

async function statusHandler(_args: string, _ctx: PiCommandContext): Promise<void> {
  const result = await status({ pin: DEFAULT_PIN, packageRoot: PACKAGE_ROOT });
  console.log(result.human);
  console.log(JSON.stringify(result.machine, null, 2));
}

async function doctorHandler(_args: string, _ctx: PiCommandContext): Promise<void> {
  const report = await doctor({ pin: DEFAULT_PIN, packageRoot: PACKAGE_ROOT });
  console.log(report.verdict);
  console.log(JSON.stringify(report, null, 2));
}

/**
 * Register the drenyra-pi extension against a Pi ExtensionAPI.
 *
 * `/drenyra:status` and `/drenyra:doctor` run the same fail-closed runtime
 * verification core (runtime/doctor.ts) and print human + machine output.
 * Full Pi UI rendering (ctx.ui panels, RUC/period scope validation) belongs to
 * the commands vertical — see contracts/package-contract.md "Command contract".
 */
export function registerDrenyraPiExtension(pi: PiExtensionApi): void {
  pi.registerCommand("drenyra:status", {
    description:
      "Show verification status of the pinned Drenyra AI runtime (checksum + version, package-local).",
    handler: statusHandler,
  });
  pi.registerCommand("drenyra:doctor", {
    description:
      "Run the fail-closed runtime doctor against the pinned Drenyra AI runtime.",
    handler: doctorHandler,
  });
}

/**
 * Default export: the extension factory, matching gentle-pi's
 * `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>` shape.
 */
export default function drenyraPi(pi: PiExtensionApi): void {
  registerDrenyraPiExtension(pi);
}
