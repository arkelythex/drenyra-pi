// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module registers the Drenyra Pi extension; it holds no money logic.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ScopeContextStore, loadCanonicalScope } from "../runtime/context.js";
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

/**
 * The installed package root, found by walking up from this module's own
 * location to the first package.json named "drenyra-pi".
 *
 * Source layout: <package>/extensions/register.ts → package root is 2 levels up.
 * Compiled layout: <package>/dist/extensions/register.js → 3 levels up.
 * Walking up is correct in both, so the shipped extension resolves the package
 * root inside the packed artifact (doctor/status are always package-local).
 */
function findPackageRoot(fromDir: string): string {
  let dir = fromDir;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const raw = readFileSync(join(dir, "package.json"), "utf8");
      const manifest = JSON.parse(raw) as { name?: unknown };
      if (manifest.name === "drenyra-pi") return dir;
    } catch {
      // not this directory — keep walking up
    }
    dir = dirname(dir);
  }
  throw new Error("drenyra-pi: package root not found above this module");
}

const PACKAGE_ROOT = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

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
  provides: ["status", "doctor", "context"] as const,
  commands: [
    "/drenyra:status",
    "/drenyra:doctor",
    "/drenyra:company",
    "/drenyra:period",
    "/drenyra:context",
    "/drenyra:close",
      ] as const,
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

/** Context store for the company/period commands (user-level, atomic writes). */
const contextStore = new ScopeContextStore();

async function companyHandler(args: string, _ctx: PiCommandContext): Promise<void> {
  const ruc = args.trim();
  if (ruc.length === 0) {
    console.log("drenyra:company: usage: /drenyra:company <ruc> (11 digits, checksummed)");
    return;
  }
  try {
    const company = contextStore.setCompany(ruc);
    console.log(`drenyra:company: RUC ${company.ruc} set and persisted.`);
  } catch (error) {
    console.log(`drenyra:company: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function periodHandler(args: string, _ctx: PiCommandContext): Promise<void> {
  const period = args.trim();
  if (period.length === 0) {
    console.log("drenyra:period: usage: /drenyra:period <YYYYMM>");
    return;
  }
  try {
    const fiscal = contextStore.setPeriod(period);
    console.log(`drenyra:period: period ${fiscal.period} set and persisted.`);
  } catch (error) {
    console.log(`drenyra:period: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function contextHandler(_args: string, _ctx: PiCommandContext): Promise<void> {
  const scope = contextStore.load();
  const company = scope.company?.ruc ?? "NOT SET";
  const period = scope.period?.period ?? "NOT SET";
  console.log(`drenyra:context: company RUC ${company} | fiscal period ${period}`);
  console.log(JSON.stringify(scope, null, 2));
}

    async function closeHandler(args: string, _ctx: PiCommandContext): Promise<void> {
      const approverId = args.trim();
      if (approverId.length === 0) {
        console.log("drenyra:close: usage: /drenyra:close <approverId> (R2: explicit approval)");
        return;
      }
      try {
        const scope = contextStore.load();
        const report = loadCanonicalScope(scope);
        if (!report.complete) {
          console.log(
            `drenyra:close: cannot run — canonical scope incomplete; missing: ${report.missing.join(", ")}. ` +
              "Bind the full 10-element scope before closing (PR #5 scope-guard).",
          );
          return;
        }
        console.log(
          "drenyra:close: the monthly-close chain requires a complete canonical scope and explicit " +
            "materiality — the command wiring lands with the PR #5 scope-guard (S4a).",
        );
      } catch (error) {
        console.log(`drenyra:close: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

/**
 * Register the drenyra-pi extension against a Pi ExtensionAPI.
 *
 * `/drenyra:status` and `/drenyra:doctor` run the same fail-closed runtime
 * verification core (runtime/doctor.ts); `/drenyra:company`, `/drenyra:period`
 * and `/drenyra:context` manage the RUC/period scope (runtime/context.ts).
 * Full Pi UI rendering (ctx.ui panels) belongs to a later vertical —
 * see contracts/package-contract.md "Command contract".
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
  pi.registerCommand("drenyra:company", {
    description:
      "Set the company context (RUC, checksummed) for the session — scope for every command.",
    handler: companyHandler,
  });
  pi.registerCommand("drenyra:period", {
    description:
      "Set the fiscal period context (YYYYMM) for the session — scope for every command.",
    handler: periodHandler,
  });
  pi.registerCommand("drenyra:context", {
    description: "Show the current company (RUC) and fiscal period context.",
    handler: contextHandler,
  });
  pi.registerCommand("drenyra:close", {
    description:
      "Run the monthly-close RDA chain for the current scope with explicit R2 approval.",
    handler: closeHandler,
  });
}

/**
 * Default export: the extension factory, matching gentle-pi's
 * `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>` shape.
 */
export default function drenyraPi(pi: PiExtensionApi): void {
  registerDrenyraPiExtension(pi);
}
