// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module registers the Drenyra Pi extension; it holds no money logic.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTHORITY_MODE,
  CANONICAL_SCOPE_ELEMENTS,
  ScopeContextStore,
  type AuthorityMode,
  type CanonicalScope,
} from "../runtime/context.js";
import { doctor } from "../runtime/doctor.js";
import { DEFAULT_PIN } from "../runtime/pin.js";
import { status } from "../runtime/status.js";
import type { MissionIntent, MissionSnapshot } from "drenyra-ai/missions";
import { bindScope } from "../lib/canonicalization.js";
import {
  EDA_INTENTS,
  EdaMissionCoordinator,
  findActiveEdaMission,
} from "../lib/mission-commands.js";
import { ReceiptStore } from "../lib/receipt-store.js";
import { TrustedKeyRegistry } from "../lib/trusted-key-registry.js";
import { verifyHarnessReceipt } from "../lib/receipt-verification.js";
import { ScopeGuard } from "./scope-guard.js";
import {
  renderCapabilitiesView,
  renderModelsRegistry,
  renderStatusView,
} from "./mission-status.js";
import { showStartupPanel, type StartupPanelDeps } from "./startup-panel.js";
import {
  renderContinueResult,
  renderMissionStarted,
  renderNotAvailableDenial,
  renderReceiptVerification,
  renderReceiptView,
  renderResumeResult,
} from "./mission-commands.js";
import { runChainStep } from "../lib/chain-pipeline.js";
import {
	parseReconcileManifest,
	reconcileChain,
	type ReconcileSourceManifest,
} from "../chains/reconcile.js";

/**
 * Drenyra Pi package version. Keep in sync with package.json — the pin's
 * version is the Drenyra AI runtime version, this is the harness version.
 */
const DRENYRA_PI_VERSION = "0.0.1-prealpha.1";

/**
 * Pi extension registration model (verified against the installed gentle-pi):
 *
 * - gentle-pi package.json declares `"pi": { "extensions": ["./dist/extensions/register.js"] }`
 *   (S4a: exact compiled entry file — helper modules are named exports only).
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
  provides: [
    "status",
    "doctor",
    "context",
    "capabilities",
    "scope",
    "models",
    "mission",
    "continue",
    "resume",
    "receipt",
    "evidence",
    "verify",
    "reconcile",
  ] as const,
  commands: [
    "/drenyra:status",
    "/drenyra:doctor",
    "/drenyra:company",
    "/drenyra:period",
    "/drenyra:context",
    "/drenyra:capabilities",
    "/drenyra:scope",
    "/drenyra:models",
    "/drenyra:close",
    "/drenyra:mission",
    "/drenyra:continue",
    "/drenyra:resume",
    "/drenyra:receipt",
    "/drenyra:evidence",
    "/drenyra:verify",
    "/drenyra:reconcile",
  ] as const,
  runtime: {
    package: DEFAULT_PIN.package,
    version: DEFAULT_PIN.version,
    state: DEFAULT_PIN.state,
  },
} as const satisfies DrenyraPiExtensionDescriptor;

/** Optional per-registration dependencies (tests inject a temp context store). */
export interface DrenyraPiExtensionDeps {
  contextStore?: ScopeContextStore;
  /** Durable mission/receipt store root (tests inject a temp dir; default cwd). */
  storesRoot?: string;
}

const SCOPE_USAGE =
  "drenyra:scope: usage — /drenyra:scope (read) | " +
  "/drenyra:scope set <tenant> <organization> <company> <fiscalPeriod> " +
  "<ledgerBook> <operationType> <sourceSnapshot> <policyVersion> <actor> <authorityLevel>";

/**
 * Register the drenyra-pi extension against a Pi ExtensionAPI.
 *
 * Every handler follows the parse → scope policy → lib/chain delegation →
 * structured render order (design §10.3; REQ-CMD-004): the scope guard runs
 * first, mission/chain/evidence/approval/receipt commands fail closed without a
 * complete canonical scope, and bootstrap/read commands run under the explicit
 * pre-scope policy. Handlers contain no accounting or fiscal logic.
 */
export function registerDrenyraPiExtension(
  pi: PiExtensionApi,
  deps: DrenyraPiExtensionDeps = {},
): void {
  const contextStore = deps.contextStore ?? new ScopeContextStore();
  const storesRoot = deps.storesRoot ?? process.cwd();
  const scopeGuard = new ScopeGuard(contextStore);
    
  async function statusHandler(_args: string, _ctx: PiCommandContext): Promise<void> {
    const outcome = scopeGuard.evaluate("drenyra:status");
    const runtime = await status({ pin: DEFAULT_PIN, packageRoot: PACKAGE_ROOT });
    const scope = contextStore.load();
    // REQ-CMD-009: report the active mission + next authorized action when
    // the durable mission layout exists for the bound scope (read-only).
    let mission: MissionSnapshot | undefined;
    if (
      outcome.binding !== undefined &&
      existsSync(join(storesRoot, ".local", "missions", "snapshots"))
    ) {
      mission = await findActiveEdaMission(outcome.binding, storesRoot);
    }
    const output = await renderStatusView({
      company: scope.company?.ruc,
      period: scope.period?.period,
      runtime,
      scopeReport: outcome.report,
      binding: outcome.binding,
      mission,
    });
    console.log(output.summary);
    console.log(JSON.stringify(output.machine, null, 2));
  }

	async function doctorHandler(
		_args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
		const report = await doctor({
			pin: DEFAULT_PIN,
			packageRoot: PACKAGE_ROOT,
		});
    console.log(report.verdict);
    console.log(JSON.stringify(report, null, 2));
  }

	async function companyHandler(
		args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
    const ruc = args.trim();
    if (ruc.length === 0) {
			console.log(
				"drenyra:company: usage: /drenyra:company <ruc> (11 digits, check-digit-validated)",
			);
      return;
    }
    try {
      const company = contextStore.setCompany(ruc);
      console.log(`drenyra:company: RUC ${company.ruc} set and persisted.`);
    } catch (error) {
			console.log(
				`drenyra:company: ${error instanceof Error ? error.message : String(error)}`,
			);
    }
  }

	async function periodHandler(
		args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
    const period = args.trim();
    if (period.length === 0) {
      console.log("drenyra:period: usage: /drenyra:period <YYYYMM>");
      return;
    }
    try {
      const fiscal = contextStore.setPeriod(period);
      console.log(`drenyra:period: period ${fiscal.period} set and persisted.`);
    } catch (error) {
			console.log(
				`drenyra:period: ${error instanceof Error ? error.message : String(error)}`,
			);
    }
  }

	async function contextHandler(
		_args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
    const scope = contextStore.load();
    const company = scope.company?.ruc ?? "NOT SET";
    const period = scope.period?.period ?? "NOT SET";
		console.log(
			`drenyra:context: company RUC ${company} | fiscal period ${period}`,
		);
    console.log(JSON.stringify(scope, null, 2));
  }

	async function capabilitiesHandler(
		_args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
    const outcome = scopeGuard.evaluate("drenyra:capabilities");
    if (!outcome.ok) {
      console.log(`drenyra:capabilities: ${outcome.error}`);
      return;
    }
    const output = renderCapabilitiesView({
      version: DRENYRA_PI_VERSION,
      commands: drenyraPiExtension.commands,
      authorityModes: Object.values(AUTHORITY_MODE),
      scopeElements: [...CANONICAL_SCOPE_ELEMENTS],
    });
    console.log(output.summary);
    console.log(JSON.stringify(output.machine, null, 2));
  }

	async function scopeHandler(
		args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
		const tokens = args
			.trim()
			.split(/\s+/)
			.filter((token) => token.length > 0);
    if (tokens.length === 0) {
      const outcome = scopeGuard.evaluate("drenyra:scope");
      const binding = outcome.binding;
      console.log(
        outcome.complete
          ? `drenyra:scope: complete — scopeHash ${binding?.scopeHash}`
          : `drenyra:scope: incomplete — missing: ${outcome.missing.join(", ")}`,
      );
      console.log(
        JSON.stringify(
          {
            scope: outcome.report.scope,
            complete: outcome.complete,
            missing: outcome.missing,
            ...(binding === undefined ? {} : { scopeHash: binding.scopeHash }),
          },
          null,
          2,
        ),
      );
      return;
    }
    if (tokens[0] !== "set" || tokens.length !== 11) {
      console.log(SCOPE_USAGE);
      return;
    }
    const [
      tenant,
      organization,
      company,
      fiscalPeriod,
      ledgerBook,
      operationType,
      sourceSnapshot,
      policyVersion,
      actor,
      authorityLevel,
    ] = tokens.slice(1);
    try {
      const scope: CanonicalScope = {
        tenant,
        organization,
        company,
        fiscalPeriod,
        ledgerBook,
        operationType,
        sourceSnapshot,
        policyVersion,
        actor,
        authorityLevel: authorityLevel as AuthorityMode,
      };
      // Strict binding validates first; only a valid scope is persisted.
      const binding = bindScope(scope);
      contextStore.setCanonicalScope(scope);
      console.log(
				`drenyra:scope: bound 10-element canonical scope — scopeHash ${binding.scopeHash}`,
			);
			console.log(
				JSON.stringify(
					{ scope, scopeHash: binding.scopeHash, version: binding.version },
					null,
					2,
				),
      );
    } catch (error) {
			console.log(
				`drenyra:scope: ${error instanceof Error ? error.message : String(error)}`,
			);
    }
  }

	async function modelsHandler(
		_args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
    const outcome = scopeGuard.evaluate("drenyra:models");
    if (!outcome.ok) {
      console.log(`drenyra:models: ${outcome.error}`);
      return;
    }
    const output = renderModelsRegistry();
    console.log(output.summary);
    console.log(JSON.stringify(output.machine, null, 2));
  }

	async function closeHandler(
		args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
    const approverId = args.trim();
    if (approverId.length === 0) {
			console.log(
				"drenyra:close: usage: /drenyra:close <approverId> (R2: explicit approval)",
			);
      return;
    }
    const outcome = scopeGuard.evaluate("drenyra:close");
    if (!outcome.ok) {
      console.log(`drenyra:close: ${outcome.error}`);
      return;
    }
        console.log(
          "drenyra:close: the monthly-close chain requires explicit materiality — " +
            "the command body lands with the PR #5 scope-guard (S4a).",
        );
      }
    
      const MISSION_USAGE =
        "drenyra:mission: usage — /drenyra:mission <intent> " +
        "(monthly-close | correction | reconciliation | invoice-review | compliance-check)";
    
      async function missionHandler(args: string, _ctx: PiCommandContext): Promise<void> {
        const intent = args.trim();
        const outcome = scopeGuard.evaluate("drenyra:mission");
        if (!outcome.ok) {
          console.log(`drenyra:mission: ${outcome.error}`);
          return;
        }
        const binding = outcome.binding;
		if (
			binding === undefined ||
			!(EDA_INTENTS as readonly string[]).includes(intent)
		) {
          console.log(MISSION_USAGE);
          console.log(
            JSON.stringify(
              {
                command: "mission",
                error: `unknown intent "${intent}" — expected one of ${EDA_INTENTS.join(", ")}`,
                intents: [...EDA_INTENTS],
              },
              null,
              2,
            ),
          );
          return;
        }
        try {
          const coordinator = new EdaMissionCoordinator(binding, { storesRoot });
          const mission = await coordinator.start({
            intent: intent as MissionIntent,
          });
          const output = renderMissionStarted({
            mission,
            scopeHash: binding.scopeHash,
            authorityMode: binding.scope.authorityLevel,
          });
          console.log(output.summary);
          console.log(JSON.stringify(output.machine, null, 2));
        } catch (error) {
          console.log(`drenyra:mission: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    
      async function continueHandler(args: string, _ctx: PiCommandContext): Promise<void> {
        const missionId = args.trim();
        const outcome = scopeGuard.evaluate("drenyra:continue");
        if (!outcome.ok) {
          console.log(`drenyra:continue: ${outcome.error}`);
          return;
        }
        const binding = outcome.binding;
        if (binding === undefined) {
			console.log(
				"drenyra:continue: canonical scope present but invalid — re-bind via /drenyra:scope",
			);
          return;
        }
        const coordinator = new EdaMissionCoordinator(binding, { storesRoot });
        try {
          let targetId = missionId;
          if (targetId.length === 0) {
            const active = await coordinator.findActiveMission();
            if (active === undefined) {
              console.log(
                "drenyra:continue: no active mission for the bound company + fiscal period — " +
                  "start one with /drenyra:mission <intent> or pass a mission id",
              );
              console.log(
                JSON.stringify(
                  {
                    command: "continue",
                    missionId: null,
                    status: "no_active_mission",
                    error:
                      "no active mission for the bound company + fiscal period — " +
                      "start one with /drenyra:mission <intent> or pass a mission id",
                  },
                  null,
                  2,
                ),
              );
              return;
            }
            targetId = active.id;
          }
          const result = await coordinator.advance({ missionId: targetId });
          const output = renderContinueResult({ result });
          console.log(output.summary);
          console.log(JSON.stringify(output.machine, null, 2));
        } catch (error) {
          console.log(`drenyra:continue: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    
      async function resumeHandler(args: string, _ctx: PiCommandContext): Promise<void> {
        const missionId = args.trim();
        if (missionId.length === 0) {
          console.log("drenyra:resume: usage — /drenyra:resume <mission-id>");
          return;
        }
        const outcome = scopeGuard.evaluate("drenyra:resume");
        if (!outcome.ok) {
          console.log(`drenyra:resume: ${outcome.error}`);
          return;
        }
        const binding = outcome.binding;
        if (binding === undefined) {
			console.log(
				"drenyra:resume: canonical scope present but invalid — re-bind via /drenyra:scope",
			);
          return;
        }
        const coordinator = new EdaMissionCoordinator(binding, { storesRoot });
        try {
          const exists = await coordinator.stores.store.findById(missionId);
          if (exists === undefined) {
				console.log(
					`drenyra:resume: mission ${missionId} not found in the durable mission store`,
				);
            console.log(
              JSON.stringify(
                {
                  command: "resume",
                  missionId,
                  outcome: "not-found",
                  status: null,
                  recovery: { recovered: [], preserved: [], unresolved: [] },
                },
                null,
                2,
              ),
            );
            return;
          }
          const report = await coordinator.resumeAll();
          const after = await coordinator.stores.store.findById(missionId);
          const output = renderResumeResult({
            missionId,
            report,
            status: after?.status ?? null,
          });
          console.log(output.summary);
          console.log(JSON.stringify(output.machine, null, 2));
        } catch (error) {
          console.log(`drenyra:resume: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    
      const RECEIPT_USAGE =
        "drenyra:receipt: usage — /drenyra:receipt <id> | /drenyra:receipt verify <id>";
    
      async function receiptHandler(args: string, _ctx: PiCommandContext): Promise<void> {
        const tokens = args.trim().split(/\s+/).filter((token) => token.length > 0);
        const outcome = scopeGuard.evaluate("drenyra:receipt");
        if (!outcome.ok) {
          console.log(`drenyra:receipt: ${outcome.error}`);
          return;
        }
        const binding = outcome.binding;
        if (binding === undefined) {
			console.log(
				"drenyra:receipt: canonical scope present but invalid — re-bind via /drenyra:scope",
			);
          return;
        }
        const store = new ReceiptStore(storesRoot);
        if (tokens.length === 0) {
          console.log(RECEIPT_USAGE);
          return;
        }
        try {
          if (tokens[0] === "verify") {
            if (tokens.length !== 2) {
              console.log(RECEIPT_USAGE);
              return;
            }
            const id = tokens[1] ?? "";
            const record = await store.load(id);
            if (record === undefined) {
					console.log(
						`drenyra:receipt verify ${id}: receipt not found in the local receipt store`,
					);
              console.log(
                JSON.stringify(
							{
								command: "receipt:verify",
								receiptHash: id,
								valid: false,
								error: "receipt not found",
							},
                  null,
                  2,
                ),
              );
              return;
            }
            const registry = new TrustedKeyRegistry(
              join(storesRoot, ".local", "trusted-keys.json"),
              storesRoot,
            );
            const verification = await verifyHarnessReceipt(
              {
                record,
                expectedScope: binding,
                expectedMissionId: record.receipt.content.missionId,
                expectedPolicyVersion: record.binding.policyVersion,
                expectedTargetHash: record.binding.targetHash,
              },
              registry,
            );
            const output = renderReceiptVerification({ record, verification });
            console.log(output.summary);
            console.log(JSON.stringify(output.machine, null, 2));
            return;
          }
          if (tokens.length !== 1) {
            console.log(RECEIPT_USAGE);
            return;
          }
          const id = tokens[0] ?? "";
          const record = await store.load(id);
          if (record === undefined) {
            console.log(`drenyra:receipt ${id}: receipt not found in the local receipt store`);
            return;
          }
          const output = renderReceiptView(record);
          console.log(output.summary);
          console.log(JSON.stringify(output.machine, null, 2));
        } catch (error) {
          console.log(`drenyra:receipt: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    
      function notAvailableHandler(command: string) {
        return async (_args: string, _ctx: PiCommandContext): Promise<void> => {
          const outcome = scopeGuard.evaluate(command);
          if (!outcome.ok) {
            console.log(`${command}: ${outcome.error}`);
            return;
          }
			const output = renderNotAvailableDenial(
				command,
				outcome.binding?.scopeHash,
			);
          console.log(output.summary);
          console.log(JSON.stringify(output.machine, null, 2));
        };
      }

	/**
	 * /drenyra:reconcile — run the reconciliation chain (T-S5A-002). The
	 * handler is thin: validate scope, parse the bounded manifest, run exactly
	 * one chain step, render the outcome. The chain enforces the ANALYZE
	 * authority minimum (stage "mode" blocks below it).
	 */
	async function reconcileHandler(
		args: string,
		_ctx: PiCommandContext,
	): Promise<void> {
		const manifestText = args.trim();
		const outcome = scopeGuard.evaluate("drenyra:reconcile");
		if (!outcome.ok) {
			console.log(`drenyra:reconcile: ${outcome.error}`);
			return;
		}
		const binding = outcome.binding;
		if (binding === undefined) {
			console.log(
				"drenyra:reconcile: canonical scope present but invalid — re-bind via /drenyra:scope",
			);
			return;
		}
		let manifest: ReconcileSourceManifest | undefined;
		if (manifestText.length > 0) {
			try {
				manifest = parseReconcileManifest(manifestText);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.log(`drenyra:reconcile: ${message}`);
				console.log(
					JSON.stringify(
						{
							command: "reconcile",
							status: "invalid_manifest",
							error: message,
						},
						null,
						2,
					),
				);
				return;
			}
		}
		try {
			const result = await runChainStep(reconcileChain, {
				binding,
				input: { manifest },
				storesRoot,
			});
			if (result.blocked !== undefined) {
				console.log(`drenyra:reconcile: ${result.blocked.reason}`);
				console.log(
					JSON.stringify(
						{
							command: "reconcile",
							status: result.blocked.stage === "mode" ? "denied" : "blocked",
							reason: result.blocked.reason,
						},
						null,
						2,
					),
				);
				return;
			}
			const mission = result.mission;
			console.log(
				`drenyra:reconcile: chain ${result.chain} on mission ${mission?.id ?? "?"} — ` +
					`phase ${result.phase ?? "started"} (${mission?.status ?? "?"})`,
			);
			console.log(
				JSON.stringify(
					{
						command: "reconcile",
						chain: result.chain,
						missionId: mission?.id,
						intent: result.intent,
						phase: result.phase,
						status: mission?.status,
						version: mission?.version,
					},
					null,
					2,
				),
			);
		} catch (error) {
			console.log(
				`drenyra:reconcile: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

  pi.registerCommand("drenyra:status", {
    description:
      "Show verification status of the pinned Drenyra AI runtime plus the active scope and mission projection (structured JSON + human summary).",
    handler: statusHandler,
  });
  pi.registerCommand("drenyra:doctor", {
    description:
      "Run the fail-closed runtime doctor against the pinned Drenyra AI runtime.",
    handler: doctorHandler,
  });
  pi.registerCommand("drenyra:company", {
    description:
      "Set the company context (RUC, check-digit-validated) for the session — scope for every command.",
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
  pi.registerCommand("drenyra:capabilities", {
    description:
      "Report engine capabilities plus harness capabilities: authority modes, registered commands, and the 10 scope elements.",
    handler: capabilitiesHandler,
  });
  pi.registerCommand("drenyra:scope", {
    description:
      "Read or bind the full 10-element canonical scope (supersedes and stays compatible with company/period/context).",
    handler: scopeHandler,
  });
  pi.registerCommand("drenyra:models", {
    description:
      "Show the documented model-routing capability registry (advisory; no Pi model-routing API in this slice).",
    handler: modelsHandler,
  });
  pi.registerCommand("drenyra:close", {
    description:
      "Run the monthly-close RDA chain for the current scope with explicit R2 approval.",
    handler: closeHandler,
  });
  pi.registerCommand("drenyra:mission", {
    description:
      "Start an EDA mission for the current scope + intent over the durable mission stores " +
      "(full 13-step plan, bound authority mode).",
    handler: missionHandler,
  });
  pi.registerCommand("drenyra:continue", {
    description:
      "Advance the active mission EXACTLY ONE EDA phase per invocation — the runtime decides " +
      "the next step (RUN/SKIP/WAIT); WAIT states never auto-advance; no continue-all.",
    handler: continueHandler,
  });
  pi.registerCommand("drenyra:resume", {
    description:
      "Recover interrupted missions after a restart via the engine recovery policy " +
      "(UNKNOWN decided by evidence; human-wait and terminal missions untouched).",
    handler: resumeHandler,
  });
  pi.registerCommand("drenyra:receipt", {
    description:
      "Show a stored receipt or verify one locally against the trusted-key registry " +
      "(/drenyra:receipt <id> | /drenyra:receipt verify <id>).",
    handler: receiptHandler,
  });
  pi.registerCommand("drenyra:evidence", {
    description:
      "Evidence graph operations for the active mission (registered; the chain lands in PR #8).",
    handler: notAvailableHandler("drenyra:evidence"),
  });
  pi.registerCommand("drenyra:verify", {
    description:
      "Run the integrity verify chain (registered; the chain lands in PR #8).",
    handler: notAvailableHandler("drenyra:verify"),
  });
  pi.registerCommand("drenyra:reconcile", {
    description:
			"Run the reconciliation chain: ingest the bounded source manifest, detect " +
			"bank-vs-ledger discrepancies as evidence-cited anomalies, wait for evidence, " +
			"and raise an evidence-cited proposal (ANALYZE minimum; PREPARE for proposals).",
		handler: reconcileHandler,
  });
}

/**
 * Default export: the extension factory, matching gentle-pi's
 * `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>` shape.
 *
 * The factory is async: it registers commands first, then emits the activation
 * banner (design §10.2). A banner failure degrades status without granting any
 * mission capability, and never breaks command registration. The optional
 * deps (injectable context store + banner sink) exist for tests; Pi invokes
 * the factory with a single argument.
 */
export default async function drenyraPi(
  pi: PiExtensionApi,
  deps: DrenyraPiExtensionDeps & Partial<StartupPanelDeps> = {},
): Promise<void> {
  registerDrenyraPiExtension(pi, deps);
  await showStartupPanel({
    writeLine: (line) => console.log(line),
    packageRoot: PACKAGE_ROOT,
    contextStore: deps.contextStore ?? new ScopeContextStore(),
    ...(deps.writeLine === undefined ? {} : { writeLine: deps.writeLine }),
		...(deps.packageRoot === undefined
			? {}
			: { packageRoot: deps.packageRoot }),
  });
}
