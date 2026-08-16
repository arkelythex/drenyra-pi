/**
 * Extension wiring tests for /drenyra:close — the monthly-close RDA chain
 * through the established safe path (scope guard -> binding -> MonthlyCloseChain
 * -> structured render; REQ-CMD-004/008).
 *
 * Covers the command contract end-to-end on bounded fixture sources: fail
 * closed without an approver id or without a complete canonical scope (no
 * mutation), the evidence-wait fail-closed (REQ-MISS-009: wait states never
 * auto-advance), and the full close with evidence in the graph -> COMPLETED
 * with a signed receipt persisted, the approval recorded, and the export
 * artifact written. Every gate (scope, materiality, approval) is exercised
 * through the command path, never bypassed.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountingMissionStatus, WaitReason } from "drenyra-ai/missions";
import {
	registerDrenyraPiExtension,
	type PiCommandContext,
	type PiExtensionApi,
} from "../extensions/register.js";
import { ScopeContextStore } from "../runtime/context.js";
import { makeCanonicalScope } from "./helpers/authority-fixtures.js";
import { ReceiptStore } from "../lib/receipt-store.js";

interface RegisteredCommand {
	name: string;
	description: string;
	handler: (args: string, ctx: PiCommandContext) => Promise<void>;
}

function makeMockPi(): { pi: PiExtensionApi; registered: RegisteredCommand[] } {
	const registered: RegisteredCommand[] = [];
	const pi: PiExtensionApi = {
		registerCommand(name, options) {
			registered.push({
				name,
				description: options.description ?? "",
				handler: options.handler,
			});
		},
		on(_event: string, _handler: (event: unknown, ctx: unknown) => void): void {},
		registerTool(_tool: { name: string; description: string; parameters: unknown; execute(toolCallId: string, params: Record<string, unknown>): unknown }): void {},
	};
	return { pi, registered };
}

/** Parse the pretty-printed machine JSON block that starts after the summary. */
function parseMachineOutput(output: string): unknown {
	const lines = output.split("\n");
	const start = lines.findIndex((line) => line.startsWith("{"));
	expect(start).toBeGreaterThanOrEqual(0);
	return JSON.parse(lines.slice(start).join("\n")) as unknown;
}

async function runHandler(
	handler: (args: string, ctx: PiCommandContext) => Promise<void>,
	args: string,
): Promise<string> {
	let output = "";
	const originalLog = console.log;
	console.log = (line: unknown) => {
		output += `${String(line)}\n`;
	};
	try {
		await handler(args, { cwd: process.cwd() });
	} finally {
		console.log = originalLog;
	}
	return output;
}

const DIRS: string[] = [];

function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-close-cmd-"));
	DIRS.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of DIRS.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** Fixture sources the evidence chain lands in the close mission's graph. */
const SOURCE_NODES = [
	{
		id: "src-balance",
		nodeKind: "source",
		payload: {
			kind: "balance-snapshot",
			reference: "BAL-202507",
			amountCents: 1_000_000,
		},
	},
	{
		id: "src-mayor",
		nodeKind: "source",
		payload: {
			kind: "mayor-snapshot",
			reference: "MAY-202507",
			amountCents: 600_000,
		},
	},
	{
		id: "src-auxiliaries",
		nodeKind: "source",
		payload: {
			kind: "auxiliaries-snapshot",
			reference: "AUX-202507",
			amountCents: 400_000,
		},
	},
	{
		id: "src-bank",
		nodeKind: "source",
		payload: {
			kind: "bank-movements",
			reference: "BNK-202507",
			amountCents: 250_000,
		},
	},
];

interface CloseMachine {
	command: string;
	chain: string;
	missionId: string;
	status: string;
	version: number;
	phase: string | null;
	progress: number;
	waitReason: string | null;
	approverId: string;
	receiptHash: string | null;
	approval: {
		approverId: string;
		at: string;
		reason: string;
	} | null;
}

describe("drenyra:close command wiring (S3b intact; REQ-CMD-004/008)", () => {
	it("fails closed without an approver id and mutates nothing", async () => {
		const root = tempRoot();
		const { pi, registered } = makeMockPi();
		const store = new ScopeContextStore(join(root, "context.json"));
		registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
		store.setCanonicalScope(makeCanonicalScope());
		const command = registered.find((c) => c.name === "drenyra:close");
		expect(command).toBeDefined();
		const output = await runHandler(command!.handler, "");
		expect(output).toContain("usage");
		expect(output).toContain("approver");
		// No mission, receipt, or export store was created: nothing mutated.
		expect(existsSync(join(root, ".local"))).toBe(false);
	});

	it("fails closed without a complete canonical scope and mutates nothing", async () => {
		const root = tempRoot();
		const { pi, registered } = makeMockPi();
		registerDrenyraPiExtension(pi, {
			contextStore: new ScopeContextStore(join(root, "context.json")),
			storesRoot: root,
		});
		const command = registered.find((c) => c.name === "drenyra:close");
		expect(command).toBeDefined();
		const output = await runHandler(command!.handler, "contador-01");
		expect(output).toContain("missing");
		expect(output).not.toContain("verified");
		expect(existsSync(join(root, ".local"))).toBe(false);
	});

	it("waits for evidence without source refs and reports the wait (REQ-MISS-009)", async () => {
		const root = tempRoot();
		const { pi, registered } = makeMockPi();
		const store = new ScopeContextStore(join(root, "context.json"));
		registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
		store.setCanonicalScope(makeCanonicalScope());
		const command = registered.find((c) => c.name === "drenyra:close");
		expect(command).toBeDefined();
		const output = await runHandler(command!.handler, "contador-01");
		expect(output).toContain("drenyra:close:");
		const machine = parseMachineOutput(output) as CloseMachine;
		expect(machine.command).toBe("close");
		expect(machine.chain).toBe("monthly-close");
		expect(machine.missionId.length).toBeGreaterThan(0);
		expect(machine.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
		// Nothing advanced past the wait; nothing was sealed.
		expect(machine.phase).toBeNull();
		expect(machine.waitReason).toBe(WaitReason.EVIDENCE);
		expect(machine.receiptHash).toBeNull();
		expect(machine.approval).toBeNull();
	});

	it("completes the close with evidence in the graph: signed receipt, approval, export (REQ-CHAIN-001/007)", async () => {
		const root = tempRoot();
		const { pi, registered } = makeMockPi();
		const store = new ScopeContextStore(join(root, "context.json"));
		registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
		store.setCanonicalScope(makeCanonicalScope());
		const closeCmd = registered.find((c) => c.name === "drenyra:close");
		const evidenceCmd = registered.find((c) => c.name === "drenyra:evidence");
		expect(closeCmd).toBeDefined();
		expect(evidenceCmd).toBeDefined();

		// First close attempt: no evidence yet -> the mission waits (fail closed).
		let output = await runHandler(closeCmd!.handler, "contador-01");
		const first = parseMachineOutput(output) as CloseMachine;
		expect(first.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
		const missionId = first.missionId;

		// Evidence lands in the close mission's graph through the evidence chain.
		for (const source of SOURCE_NODES) {
			output = await runHandler(
				evidenceCmd!.handler,
				JSON.stringify({
					missionId,
					op: "add-node",
					node: source,
				}),
			);
			expect(output).toContain("drenyra:evidence:");
		}

		// Second close attempt: the graph holds evidence -> the close completes.
		output = await runHandler(closeCmd!.handler, "contador-01");
		expect(output).toContain("COMPLETED");
		const machine = parseMachineOutput(output) as CloseMachine;
		expect(machine.command).toBe("close");
		expect(machine.chain).toBe("monthly-close");
		expect(machine.missionId).toBe(missionId);
		expect(machine.status).toBe(AccountingMissionStatus.COMPLETED);
		expect(machine.waitReason).toBeNull();
		expect(machine.approverId).toBe("contador-01");
		expect(machine.receiptHash).toMatch(/^[0-9a-f]{64}$/);
		expect(machine.approval).not.toBeNull();
		expect(machine.approval!.approverId).toBe("contador-01");

		// The signed completion receipt is persisted in the immutable receipt store.
		const persisted = await new ReceiptStore(root).load(machine.receiptHash!);
		expect(persisted).toBeDefined();
		expect(persisted!.binding.scopeHash).toMatch(/^[0-9a-f]{64}$/);
		expect(persisted!.receipt.content.missionId).toBe(missionId);

		// The export artifact exists (v0.1 step 12).
		expect(
			existsSync(join(root, ".local", "exports", `${missionId}.json`)),
		).toBe(true);
	});
});
