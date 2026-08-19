/**
 * drenyra-pi — Fiscal Guard extension.
 *
 * Ported from the legacy `@drenyra/pi` package (`packages/pi` in
 * drenyra-command-center) as part of the vertical-slice extraction: the
 * fiscal tools, persona command, and write guards that used to live in the
 * monorepo package now ship with the standalone harness.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Version/exit codes are JSON integers, never
 * floats. This module registers tools and guards; it holds no money logic.
 *
 * The ExtensionAPI is consumed structurally (same idiom as register.ts) so the
 * package never hard-imports the optional Pi peer dependency.
 */

import { Type } from "typebox";

// ─── Structural slice of the Pi ExtensionAPI (register.ts idiom) ────────────

export interface FiscalGuardCommandContext {
	cwd?: string;
	ui?: {
		notify(message: string, level?: "info" | "warning" | "error"): void;
		setStatus?(label: string, message: string): void;
	};
}

export interface FiscalGuardExtensionAPI {
	on(event: string, handler: (event: unknown, ctx: unknown) => void): void;
	registerCommand(
		name: string,
		options: {
			description?: string;
			handler: (args: string, ctx: FiscalGuardCommandContext) => Promise<void>;
		},
	): void;
	registerTool(tool: {
		name: string;
		label?: string;
		description: string;
		parameters: unknown;
		execute(toolCallId: string, params: Record<string, unknown>): unknown;
	}): void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VERSION = "0.0.1-prealpha.1";

const FISCAL_PHASES = [
	"captura",
	"clasificacion",
	"conciliacion",
	"cierre",
	"declaracion",
	"auditoria",
] as const;

const PHASE_LABELS: Record<string, string> = {
	captura: "Captura de Comprobantes",
	clasificacion: "Clasificación PCGE",
	conciliacion: "Conciliación Bancaria",
	cierre: "Cierre Contable Mensual",
	declaracion: "Declaración SUNAT",
	auditoria: "Auditoría y Cierre Fiscal",
};

const RISK_TIERS: Record<string, string> = {
	captura: "R0",
	clasificacion: "R0",
	conciliacion: "R1",
	cierre: "R2",
	declaracion: "R1",
	auditoria: "R3",
};

const PERSONA = [
	"── ⚖️ Drenyra Fiscal Accounting Guard ──",
	"Rules every agent MUST follow:",
	"",
	"1. MONEY: NEVER use floats or raw numbers.",
	"   Use the project's Money type or whole-number cents (BigInt).",
	"2. RUC SCOPE: Every query/mutation must verify tenant isolation.",
	"   Never access data across RUCs without explicit context.",
	"3. FSD DISCIPLINE: Follow the fiscal lifecycle in order:",
	"   captura → clasificacion → conciliacion → cierre → declaracion → auditoria",
	"4. GATES: Phase transitions require gate validation.",
	"5. AUDIT: Every material action logged with RUC, periodo, timestamp.",
	"6. CIERRE: Monthly close requires human approval (R2).",
	"7. SUNAT/UBL/IGV: Changes require compliance tests.",
	"8. RED: Every mutation produces an immutable receipt record.",
	"",
	"Commands: /drenyra:status  /drenyra:doctor  /drenyra:mission  /drenyra:persona",
	"── ──",
].join("\n");

// ─── Module-level state (per-process, survives session_start) ───────────────

let personaDisabled = false;

// ─── Guards ────────────────────────────────────────────────────────────────

export interface BlockDecision {
	block: true;
	reason: string;
}

// Guard 1: Money types in write operations.
//
// Refined 2026-08-10 (owner-approved): a money WORD alone is not evidence
// of a monetary value — "highest-value", "period values" and the Go
// stdlib identifier `PathValue` are legitimate. The trigger requires the
// word to be near a money INDICATOR (digit or currency symbol/ISO code)
// within 14 characters (either order), so "amount: 1500n", "total
// S/ 22417.80" and "igv 18%" still block, while prose and identifiers
// pass. The repo convention escape (Money|cents|BigInt|whole|.00|
// bignumber) remains a secondary release valve.
const MONEY_TRIGGER =
	/\b(?:number|amount|precio|monto|total|igv|price|value)\b/i;
const MONEY_INDICATOR = /(?:[0-9]|S\/|\$|€|£|\b(?:PEN|USD|EUR|soles)\b)/i;
// .source carries no delimiters — embed directly (no slicing).
const moneyNearby = new RegExp(
	`(?:${MONEY_TRIGGER.source}.{0,14}${MONEY_INDICATOR.source})` +
		`|(?:${MONEY_INDICATOR.source}.{0,14}${MONEY_TRIGGER.source})`,
	"i",
);

function guardMoneyWrite(event: {
	toolName: string;
	input: unknown;
}): BlockDecision | null {
	if (event.toolName !== "edit" && event.toolName !== "write") return null;
	const inputStr = extractWrittenText(event.input);
	if (!moneyNearby.test(inputStr)) return null;
	if (/Money|cents|BigInt|whole|\.00|bignumber/i.test(inputStr)) return null;
	return {
		block: true,
		reason:
			"drenyra-pi: Monetary values must use BigInt (cents). Floats are blocked. Use `amount: 1500n` for S/15.00.",
	};
}

/**
 * Extract only the text a write actually introduces.
 *
 * The Pi edit tool passes `{ filePath, edits: [{ oldText, newText }] }`: the
 * `oldText` is content being REPLACED, never new content — scanning it caused
 * false positives (e.g. replacing a test title containing "total" next to a
 * digit tripped the money guard even though no monetary value was written).
 * Only `newText` of every edit, or the full `content` of a write, is evaluated.
 */
function extractWrittenText(input: unknown): string {
	if (input !== null && typeof input === "object") {
		const edits = (input as { edits?: unknown[] }).edits;
		if (Array.isArray(edits) && edits.length > 0) {
			return edits
				.map((edit) => ((edit as { newText?: string }).newText ?? "").trim())
				.join("\n");
		}
		const content = (input as { content?: unknown }).content;
		if (typeof content === "string") return content;
	}
	return typeof input === "string" ? input : JSON.stringify(input);
}

// Guard 2: SQL safety in bash.
function guardSQLBash(event: {
	toolName: string;
	input: unknown;
}): BlockDecision | null {
	if (event.toolName !== "bash") return null;
	const raw = event.input as Record<string, unknown> | string | undefined;
	const cmd =
		typeof raw === "string"
			? raw
			: (((raw as Record<string, unknown> | undefined)?.command as
					| string
					| undefined) ?? "");
	if (
		/WHERE\s+ruc\s*=/i.test(cmd) &&
		!/WHERE\s+ruc\s*=\s*:currentRuc/i.test(cmd)
	) {
		return {
			block: true,
			reason:
				"drenyra-pi: RUC-scoped query must use `:currentRuc`. Unsafe RUC filter.",
		};
	}
	if (cmd.includes("DELETE FROM") && !cmd.includes("WHERE")) {
		return {
			block: true,
			reason:
				"drenyra-pi: Unconditional DELETE blocked. WHERE clause required for audit.",
		};
	}
	if (cmd.includes("DROP TABLE") || cmd.includes("TRUNCATE")) {
		return {
			block: true,
			reason: "drenyra-pi: Destructive DDL blocked. Use migrations instead.",
		};
	}
	return null;
}

// Guard 3: Cross-RUC reads.
function guardRucPath(event: {
	toolName: string;
	input: unknown;
}): BlockDecision | null {
	if (event.toolName !== "read" && event.toolName !== "edit") return null;
	const raw = event.input as Record<string, unknown> | string | undefined;
	const path =
		typeof raw === "string"
			? raw
			: (((raw as Record<string, unknown> | undefined)?.path as
					| string
					| undefined) ?? "");
	if (path.includes("/ruc/") && !path.includes(":ruc")) {
		return {
			block: true,
			reason:
				"drenyra-pi: RUC path without context variable. Use `:ruc` placeholder.",
		};
	}
	return null;
}

// ─── Extension registration ────────────────────────────────────────────────

export function registerFiscalGuard(pi: FiscalGuardExtensionAPI): void {
	// Session status
	pi.on("session_start", async (_event, ctx) => {
		const c = ctx as FiscalGuardCommandContext;
		c.ui?.setStatus?.("drenyra-pi", `drenyra-pi v${VERSION}`);
	});

	// Persona injection
	pi.on("before_agent_start", async (event) => {
		if (personaDisabled) return;
		const e = event as { systemPrompt?: string };
		return {
			systemPrompt: `${e.systemPrompt ?? ""}\n${PERSONA}`,
		};
	});

	// Persona command
	pi.registerCommand("drenyra:persona", {
		description: "Toggle fiscal persona on/off. Usage: /drenyra:persona off",
		handler: async (args, ctx) => {
			const cmd = args?.trim().toLowerCase();
			if (cmd === "off") {
				personaDisabled = true;
				ctx.ui?.notify("Fiscal persona disabled for this session.", "warning");
			} else if (cmd === "on") {
				personaDisabled = false;
				ctx.ui?.notify("Fiscal persona enabled.", "info");
			} else {
				ctx.ui?.notify(
					`Fiscal persona is ${personaDisabled ? "OFF" : "ON"}. Use /drenyra:persona on|off`,
					"info",
				);
			}
		},
	});

	// Tools
	pi.registerTool({
		name: "verify_fiscal_phase",
		label: "Verify Fiscal Phase",
		description: "Verify a fiscal phase transition. Returns valid/invalid.",
		parameters: Type.Object({
			fromPhase: Type.String({
				description:
					"Current phase: captura, clasificacion, conciliacion, cierre, declaracion, auditoria",
			}),
			toPhase: Type.String({ description: "Target phase to transition to" }),
		}),
		async execute(
			_toolCallId: string,
			params: { fromPhase: string; toPhase: string },
		) {
			const fromIdx = FISCAL_PHASES.indexOf(
				params.fromPhase as (typeof FISCAL_PHASES)[number],
			);
			const toIdx = FISCAL_PHASES.indexOf(
				params.toPhase as (typeof FISCAL_PHASES)[number],
			);

			if (fromIdx === -1) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Invalid: "${params.fromPhase}". Valid: ${FISCAL_PHASES.join(", ")}`,
						},
					],
					details: {},
				};
			}
			if (toIdx === -1) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Invalid: "${params.toPhase}". Valid: ${FISCAL_PHASES.join(", ")}`,
						},
					],
					details: {},
				};
			}

			if (toIdx === fromIdx + 1) {
				return {
					content: [
						{
							type: "text" as const,
							text: `✅ Valid transition: ${PHASE_LABELS[params.fromPhase]} → ${PHASE_LABELS[params.toPhase]} (${RISK_TIERS[params.toPhase]})`,
						},
					],
					details: {
						valid: true,
						fromIdx,
						toIdx,
						riskTier: RISK_TIERS[params.toPhase],
					} as Record<string, unknown>,
				};
			}

			const expected = FISCAL_PHASES[fromIdx + 1];
			return {
				content: [
					{
						type: "text" as const,
						text: `❌ Invalid: ${PHASE_LABELS[params.fromPhase]} → ${PHASE_LABELS[params.toPhase]}. Expected: ${PHASE_LABELS[expected]} (${expected})`,
					},
				],
				details: {
					valid: false,
					fromIdx,
					toIdx,
					expectedNext: expected,
				} as Record<string, unknown>,
			};
		},
	});

	pi.registerTool({
		name: "list_fiscal_phases",
		label: "List Fiscal Phases",
		description: "List the 6 FSD lifecycle phases with labels and risk tiers.",
		parameters: Type.Object({}),
		async execute() {
			const lines = FISCAL_PHASES.map(
				(id, i) => `${i + 1}. ${PHASE_LABELS[id]} (${id}) — ${RISK_TIERS[id]}`,
			);
			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
				details: { phases: FISCAL_PHASES } as Record<string, unknown>,
			};
		},
	});

	pi.registerTool({
		name: "record_receipt",
		label: "Record Receipt (RED)",
		description:
			"Record an immutable receipt for a material accounting action. This is the RED (Receipt-Driven Execution) primitive.",
		parameters: Type.Object({
			action: Type.String({ description: "Description of the action" }),
			actor: Type.String({ description: "Who performed it (agent/user)" }),
			ruc: Type.String({ description: "RUC scope" }),
			periodo: Type.String({ description: "Fiscal period YYYYMM" }),
			resource: Type.String({
				description: "Resource affected (table, file, account)",
			}),
			beforeState: Type.String({
				description: "State before the action (summary)",
			}),
			afterState: Type.String({ description: "State after the action (summary)" }),
		}),
		async execute(
			_toolCallId: string,
			params: {
				action: string;
				actor: string;
				ruc: string;
				periodo: string;
				resource: string;
				beforeState: string;
				afterState: string;
			},
		) {
			const receipt = {
				id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				timestamp: new Date().toISOString(),
				action: params.action,
				actor: params.actor,
				ruc: params.ruc,
				periodo: params.periodo,
				resource: params.resource,
				beforeState: params.beforeState,
				afterState: params.afterState,
				hash: "", // TODO: hash over receipt fields
			};

			return {
				content: [
					{
						type: "text" as const,
						text: [
							`✅ RED Receipt: ${receipt.id}`,
							`  Action: ${receipt.action}`,
							`  RUC: ${receipt.ruc} | Period: ${receipt.periodo}`,
							`  Resource: ${receipt.resource}`,
							`  Time: ${receipt.timestamp}`,
						].join("\n"),
					},
				],
				details: receipt as unknown as Record<string, unknown>,
			};
		},
	});

	pi.registerTool({
		name: "run_fiscal_lens",
		label: "Run Fiscal Lens",
		description:
			"Run a fiscal accounting review lens over the current state. Lenses: ledger-integrity, sunat-compliance, audit-trail, tenant-isolation",
		parameters: Type.Object({
			lens: Type.String({
				description:
					"Lens: ledger-integrity, sunat-compliance, audit-trail, tenant-isolation",
			}),
			ruc: Type.String({ description: "RUC scope" }),
			periodo: Type.String({ description: "Fiscal period" }),
		}),
		async execute(
			_toolCallId: string,
			params: { lens: string; ruc: string; periodo: string },
		) {
			const lensDesc: Record<string, string> = {
				"ledger-integrity":
					"Verifies double-entry bookkeeping, account balances, Money type usage",
				"sunat-compliance":
					"Verifies SUNAT document series, IGV calculation, CDR validation, SIRE reconciliation",
				"audit-trail":
					"Verifies every mutation logged with RUC, periodo, timestamp, actor, reason",
				"tenant-isolation":
					"Verifies no cross-RUC data access, RUC parameter validation, org boundaries",
			};

			const desc = lensDesc[params.lens] ?? "Unknown lens";
			return {
				content: [
					{
						type: "text" as const,
						text: [
							`🔍 Running ${params.lens} for RUC ${params.ruc}, periodo ${params.periodo}`,
							`  ${desc}`,
							`  ⏳ Analysis frame prepared. Pass findings to agent for evaluation.`,
						].join("\n"),
					},
				],
				details: {
					lens: params.lens,
					ruc: params.ruc,
					periodo: params.periodo,
				} as Record<string, unknown>,
			};
		},
	});

	pi.registerTool({
		name: "forecast_fiscal_review",
		label: "Forecast Fiscal Review",
		description:
			"Forecast review workload and recommend delivery strategy for a fiscal change.",
		parameters: Type.Object({
			estimatedLines: Type.Number({ description: "Estimated changed lines" }),
			estimatedFiles: Type.Number({ description: "Estimated changed files" }),
			isFiscalChange: Type.Boolean({ description: "Affects fiscal/SUNAT logic" }),
			isMechanicalRefactor: Type.Boolean({
				description: "Pure rename/move with no logic change",
			}),
		}),
		async execute(
			_toolCallId: string,
			params: {
				estimatedLines: number;
				estimatedFiles: number;
				isFiscalChange: boolean;
				isMechanicalRefactor: boolean;
			},
		) {
			const LINE_BUDGET = 400;
			let strategy: string;
			let chained: boolean;
			let reason: string;

			if (params.isMechanicalRefactor && params.estimatedLines <= 600) {
				strategy = "exception-ok";
				chained = false;
				reason = "Mechanical refactor, single PR OK up to 600 lines";
			} else if (params.estimatedLines > LINE_BUDGET && params.isFiscalChange) {
				strategy = "ask-on-risk";
				chained = true;
				reason = `Fiscal change exceeds ${LINE_BUDGET} lines — chained PRs REQUIRED. Each PR needs compliance review.`;
			} else if (params.estimatedLines > LINE_BUDGET) {
				strategy = "ask-on-risk";
				chained = true;
				reason = `Exceeds ${LINE_BUDGET} lines — recommend chained PRs`;
			} else if (params.isFiscalChange) {
				strategy = "single-pr";
				chained = false;
				reason = "Small fiscal change — single PR with sunat-compliance lens";
			} else {
				strategy = "single-pr";
				chained = false;
				reason = "Low risk — single PR";
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Forecast: ${reason}\nStrategy: ${strategy}${chained ? " (chained PRs)" : ""}`,
					},
				],
				details: { strategy, chainedPRsRecommended: chained, reason } as Record<
					string,
					unknown
				>,
			};
		},
	});

	// Write guards
	pi.on("tool_call", (event) => {
		const e = event as { toolName?: string; input?: unknown };
		const blocked =
			guardMoneyWrite({ toolName: e.toolName ?? "", input: e.input }) ??
			guardSQLBash({ toolName: e.toolName ?? "", input: e.input }) ??
			guardRucPath({ toolName: e.toolName ?? "", input: e.input });
		return blocked ?? undefined;
	});
}
