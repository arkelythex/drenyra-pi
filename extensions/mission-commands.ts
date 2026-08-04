/**
 * Mission lifecycle command rendering (design §10.3; REQ-CMD-008 structured
 * output). These helpers are thin: they shape persisted results into a human
 * summary plus machine-readable JSON and contain no accounting or fiscal logic
 * (REQ-CMD-004).
 *
 * Rendered commands: /drenyra:mission, /drenyra:continue, /drenyra:resume,
 * /drenyra:receipt (show + verify), and the structured `not_available` denials
 * for /drenyra:evidence, /drenyra:verify and /drenyra:reconcile (registration
 * complete in S4b; chain bodies land in PR #7/#8).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import type {
	AccountingMissionStatus,
	MissionSnapshot,
} from "drenyra-ai/missions";
import type { AdvanceEdaMissionResult } from "../lib/mission-commands.js";
import type { RecoveryReport } from "../lib/mission-store.js";
import type { HarnessReceiptRecord } from "../lib/receipt-store.js";
import type { HarnessReceiptVerification } from "../lib/receipt-verification.js";
import type { CommandOutput } from "./mission-status.js";

/** Render the /drenyra:mission result (REQ-CMD-008). */
export function renderMissionStarted(input: {
	mission: MissionSnapshot;
	scopeHash: string;
	authorityMode: string;
}): CommandOutput {
	const { mission, scopeHash, authorityMode } = input;
	const machine = {
		command: "mission",
		missionId: mission.id,
		intent: mission.intent,
		status: mission.status,
		version: mission.version,
		progress: mission.progress,
		currentStep: mission.currentStep,
		steps: mission.steps.length,
		scopeHash,
		authorityMode,
	};
	const summary =
		`drenyra:mission: mission ${mission.id} started — intent ${mission.intent} · ` +
		`${mission.status} · ${mission.steps.length}-step EDA plan · bound authority ${authorityMode}`;
	return { summary, machine };
}

const WAIT_REASON_TEXT: Readonly<Record<string, string>> = {
	EVIDENCE: "evidence",
	APPROVAL: "approval",
	POLICY_GATE: "policy gate",
	MANUAL_INTERVENTION: "manual intervention",
	EXTERNAL_SYSTEM: "external system",
};

/** Render the /drenyra:continue result — exactly one step or a wait (REQ-CMD-005). */
export function renderContinueResult(input: {
	result: AdvanceEdaMissionResult;
}): CommandOutput {
	const { result } = input;
	const mission = result.mission;
	const waitReason = result.waitReason ?? null;
	const preparedStep = result.preparedStep;
	const machine = {
		command: "continue",
		missionId: mission.id,
		phase: result.phase,
		advanced: result.phase !== null,
		disposition: preparedStep === null ? null : preparedStep.disposition,
		status: mission.status,
		version: mission.version,
		currentStep: mission.currentStep,
		progress: mission.progress,
		waitReason,
		preparedStep,
		authorityDenied: result.authorityDenied ?? null,
	};

	let summary: string;
	if (result.authorityDenied !== undefined) {
		summary =
			`drenyra:continue: mission ${mission.id} denied — phase ${result.phase ?? ""} requires ` +
			`${result.authorityDenied.requiredMode} authority for the ` +
			`${result.authorityDenied.actionFamily} family; nothing advanced`;
	} else if (result.phase !== null) {
		const verb =
			preparedStep?.disposition === "SKIP" ? "skipped" : "advanced phase";
		const next =
			preparedStep === null
				? "no further legal step"
				: `next: ${preparedStep.phase} (${preparedStep.disposition})`;
		summary =
			`drenyra:continue: mission ${mission.id} ${verb} ${result.phase} ` +
			`(${mission.status}, version ${mission.version}) — ${next}`;
	} else if (waitReason !== null) {
		const reason =
			WAIT_REASON_TEXT[waitReason] ?? String(waitReason).toLowerCase();
		summary =
			`drenyra:continue: mission ${mission.id} waits on ${String(waitReason)} — ` +
			`no auto-advance (${reason} required; REQ-MISS-009)`;
	} else {
		summary = `drenyra:continue: mission ${mission.id} has no further legal step`;
	}
	return { summary, machine };
}

/** One unresolved recovery record shaped for the resume machine output. */
interface RecoveryUnresolvedView {
	missionId: string;
	reason: string;
}

/** Render the /drenyra:resume result (REQ-CMD-007; SC-CMD-006). */
export function renderResumeResult(input: {
	missionId: string;
	report: RecoveryReport;
	status: AccountingMissionStatus | null;
}): CommandOutput {
	const { missionId, report, status } = input;
	const recoveredIds = report.recovered.map((m) => m.id);
	const preservedIds = report.preserved.map((m) => m.id);
	const unresolved: RecoveryUnresolvedView[] = report.unresolved.map(
		(entry) => ({
			missionId: entry.missionId,
			reason: entry.reason,
		}),
	);

	let outcome: "recovered" | "preserved" | "unresolved" | "not-found";
	let summary: string;
	if (status === null) {
		outcome = "not-found";
		summary = `drenyra:resume: mission ${missionId} not found in the durable mission store`;
	} else if (unresolved.some((entry) => entry.missionId === missionId)) {
		outcome = "unresolved";
		summary =
			`drenyra:resume: mission ${missionId} recovery record unresolved ` +
			`(${unresolved.find((entry) => entry.missionId === missionId)?.reason}) — ` +
			"fail closed; repair is explicit and never automatic";
	} else if (recoveredIds.includes(missionId)) {
		outcome = "recovered";
		summary =
			`drenyra:resume: mission ${missionId} recovered by the engine recovery policy ` +
			`(status ${status ?? "UNKNOWN"}) — evidence-based decision required before continuation`;
	} else {
		outcome = "preserved";
		summary =
			`drenyra:resume: mission ${missionId} preserved untouched ` +
			`(human-wait or terminal state; status ${String(status)})`;
	}

	const machine = {
		command: "resume",
		missionId,
		outcome,
		status,
		recovery: {
			recovered: recoveredIds,
			preserved: preservedIds,
			unresolved,
		},
	};
	return { summary, machine };
}

/** Render /drenyra:receipt <id> — show a stored receipt (REQ-CMD-008). */
export function renderReceiptView(record: HarnessReceiptRecord): CommandOutput {
	const { binding, receipt } = record;
	const machine = {
		command: "receipt",
		receiptHash: receipt.receiptHash,
		receipt: {
			protocolVersion: receipt.protocolVersion,
			receiptType: receipt.receiptType,
			algorithm: receipt.algorithm,
			signerKeyId: receipt.signerKeyId,
			issuedAt: receipt.issuedAt,
			content: receipt.content,
		},
		binding,
	};
	const summary =
		`drenyra:receipt: receipt ${receipt.receiptHash} — ${receipt.receiptType} · ` +
		`signer ${receipt.signerKeyId} · issued ${receipt.issuedAt} · ` +
		`mission ${receipt.content.missionId} · scopeHash ${binding.scopeHash}`;
	return { summary, machine };
}

/** Render /drenyra:receipt verify <id> — the trusted-registry verdict (REQ-CMD-006). */
export function renderReceiptVerification(input: {
	record: HarnessReceiptRecord;
	verification: HarnessReceiptVerification;
}): CommandOutput {
	const { record, verification } = input;
	const machine = {
		command: "receipt:verify",
		receiptHash: record.receipt.receiptHash,
		valid: verification.valid,
		engineStatus: verification.engineStatus,
		bindingValid: verification.bindingValid,
		scopeValid: verification.scopeValid,
		targetValid: verification.targetValid,
		reasons: verification.reasons,
	};
	const summary = verification.valid
		? `drenyra:receipt verify ${record.receipt.receiptHash}: VALID — content-valid, ` +
			`signature-valid, signer-trusted, in-currency; bound scopeHash ` +
			`${record.binding.scopeHash} and target ${record.binding.targetHash}`
		: `drenyra:receipt verify ${record.receipt.receiptHash}: INVALID — ` +
			`${verification.reasons.join("; ")}`;
	return { summary, machine };
}

/** When the S4b chain body is unavailable: a typed not_available denial. */
export const NOT_AVAILABLE_POLICY: Readonly<
	Record<string, { reason: string; expectedAfter: string }>
> = {
	"drenyra:evidence": {
		reason:
			"the evidence chain is not wired yet — registration is complete; the chain lands in PR #8 (S5b)",
		expectedAfter: "PR #8 (S5b) — evidence chain",
	},
	"drenyra:verify": {
		reason:
			"the verify chain is not wired yet — registration is complete; the chain lands in PR #8 (S5b)",
		expectedAfter: "PR #8 (S5b) — verify chain",
	},
	"drenyra:reconcile": {
		reason:
			"the reconciliation chain is not wired yet — registration is complete; the chain lands in PR #7 (S5a)",
		expectedAfter: "PR #7 (S5a) — reconciliation chain",
	},
};

/** Render a structured not_available denial for a registered-but-unwired chain. */
export function renderNotAvailableDenial(
	command: string,
	scopeHash?: string,
): CommandOutput {
	const policy = NOT_AVAILABLE_POLICY[command];
	const reason =
		policy?.reason ?? "this command is registered but not wired yet";
	const expectedAfter = policy?.expectedAfter ?? "a later PR";
	const machine = {
		command,
		status: "not_available",
		reason,
		expected_after: expectedAfter,
		...(scopeHash === undefined ? {} : { scopeHash }),
	};
	const summary = `${command}: not available yet — ${reason}`;
	return { summary, machine };
}
