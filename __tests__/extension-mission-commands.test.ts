/**
 * S4b mission lifecycle command tests (T-S4B-001..003) — /drenyra:mission,
 * /drenyra:continue, /drenyra:resume, and /drenyra:receipt.
 *
 * Verifies the parse → scope policy → lib/chain delegation → render order
 * (design §10.3; REQ-CMD-004): mission creation requires a complete canonical
 * scope (SC-CMD-002), continue advances EXACTLY ONE protocol-declared prepared
 * transition per invocation with no continue-all (REQ-CMD-005; SC-CMD-003;
 * REQ-MISS-004), WAIT dispositions never auto-advance (REQ-MISS-009), resume
 * recovers interrupted missions through the engine recovery policy while
 * leaving human-wait and terminal missions untouched (REQ-CMD-007; SC-CMD-006),
 * and receipt verify reports the full local trusted-registry-backed matrix
 * (REQ-CMD-006; SC-CMD-004/005). Every command returns structured JSON plus a
 * concise human summary (REQ-CMD-008).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AccountingMissionStatus,
  type MissionIntent,
} from "drenyra-ai/missions";
import { createWorkUnit, type WorkUnit, type WorkUnitInput } from "drenyra-ai";
import {
	buildSignedReceipt,
	generateReceiptKeyPair,
} from "drenyra-ai/receipts";
import type { ReceiptContent, SigningKeyInfo } from "drenyra-ai/receipts";
import {
  registerDrenyraPiExtension,
  type PiCommandContext,
  type PiExtensionApi,
} from "../extensions/register.js";
import { ScopeContextStore, AUTHORITY_MODE } from "../runtime/context.js";
    import { bindScope } from "../lib/canonicalization.js";
    import {
      EdaMissionCoordinator,
      createDurableMissionRoutingPort,
    } from "../lib/mission-commands.js";
    import { BudgetLedger } from "../lib/routing/types.js";
import {
	ReceiptStore,
	type ReceiptBinding,
	type HarnessReceiptRecord,
} from "../lib/receipt-store.js";
import { TrustedKeyRegistry } from "../lib/trusted-key-registry.js";
import { sha256Canonical } from "../lib/canonicalization.js";
import {
	makeCanonicalScope,
	makeScopeBinding,
	type ApprovalReceiptFixture,
} from "./helpers/authority-fixtures.js";

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

interface HarnessContext {
  pi: PiExtensionApi;
  registered: RegisteredCommand[];
  store: ScopeContextStore;
  root: string;
}

/** A hermetic context store + durable-stores root so tests never touch ~/.drenyra. */
function makeHarness(rootOverride?: string): HarnessContext {
  const root = rootOverride ?? mkdtempSync(join(tmpdir(), "drenyra-s4b-"));
  const { pi, registered } = makeMockPi();
  const store = new ScopeContextStore(join(root, "context.json"));
  registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
  return { pi, registered, store, root };
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

function findCommand(ctx: HarnessContext, name: string): RegisteredCommand {
  const command = ctx.registered.find((c) => c.name === name);
  expect(command, `command ${name} registered`).toBeDefined();
  return command!;
}

/** A valid harness receipt record signed by a current trusted key. */
function makeHarnessReceiptRecord(
  binding: ReturnType<typeof makeScopeBinding>,
  overrides: { content?: Partial<ReceiptContent>; evidenceHash?: string } = {},
): ApprovalReceiptFixture & { record: HarnessReceiptRecord } {
  const keyPair = generateReceiptKeyPair("s4b-signer-001");
  const key: SigningKeyInfo = {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    issuedAt: "2026-01-01T00:00:00.000Z",
  };
  const evidenceHash = overrides.evidenceHash ?? "b".repeat(64);
  const recordBinding: ReceiptBinding = {
    version: "drenyra.receipt-binding.v1",
    scopeHash: binding.scopeHash,
    authorizationId: "auth-s4b-001",
    policyVersion: binding.scope.policyVersion,
    targetHash: "f".repeat(64),
    evidenceHash,
  };
  const content: ReceiptContent = {
    missionId: "mission-close-001",
    companyId: binding.scope.company,
    actorId: binding.scope.actor,
    decision: "APPROVE",
    proposalVersion: 1,
    evidenceHash,
    previousStatus: AccountingMissionStatus.AWAITING_APPROVAL,
    newStatus: AccountingMissionStatus.APPROVED,
    payloadHash: sha256Canonical(recordBinding),
    timestamp: "2026-07-01T00:00:00.000Z",
    ...overrides.content,
  };
  const receipt = buildSignedReceipt(content, keyPair);
  return { receipt, key, record: { binding: recordBinding, receipt } };
}

async function seedReceiptAndKey(
  root: string,
  fixture: { record: HarnessReceiptRecord; key: SigningKeyInfo },
): Promise<void> {
  await new ReceiptStore(root).save(fixture.record);
	const registry = new TrustedKeyRegistry(
		join(root, ".local", "trusted-keys.json"),
		root,
	);
  await registry.put(fixture.key);
}

describe("T-S4B-001 /drenyra:mission (REQ-CMD-001; SC-CMD-002)", () => {
  it("fails closed without a complete canonical scope (SC-CMD-002)", async () => {
    const ctx = makeHarness();
    const command = findCommand(ctx, "drenyra:mission");
    const output = await runHandler(command.handler, "monthly-close");
    // Fail-closed paths emit the explanatory summary and mutate nothing
    // (REQ-CMD-003; matches the S4a fail-closed pattern).
    expect(output).toContain("missing");
    expect(output).toContain("requires a complete 10-element canonical scope");
  });

  it("rejects an unknown intent with a usage error (structured)", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:mission");
    const output = await runHandler(command.handler, "not-an-intent");
    expect(output).toContain("usage");
		const machine = parseMachineOutput(output) as {
			error?: string;
			intents?: string[];
		};
    expect(machine.error).toBeDefined();
    expect(machine.intents).toHaveLength(5);
  });

  it("starts a durable mission with the 13-step plan and the bound authority mode", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:mission");
    const output = await runHandler(command.handler, "monthly-close");
    expect(output).toContain("started");
    const machine = parseMachineOutput(output) as {
      command: string;
      missionId: string;
      intent: string;
      status: string;
      steps: number;
      scopeHash: string;
      authorityMode: string;
    };
    expect(machine.command).toBe("mission");
    expect(machine.intent).toBe("monthly-close");
    expect(machine.status).toBe(AccountingMissionStatus.DRAFT);
    expect(machine.steps).toBe(13);
    expect(machine.scopeHash).toBe(makeScopeBinding().scopeHash);
    expect(machine.authorityMode).toBe(AUTHORITY_MODE.EXECUTE);
    // Durable: the mission persists under the injected stores root.
    const binding = makeScopeBinding();
		const coordinator = new EdaMissionCoordinator(binding, {
			storesRoot: ctx.root,
		});
		const persisted = await coordinator.stores.store.findById(
			machine.missionId,
		);
    expect(persisted).toBeDefined();
    expect(persisted!.steps).toHaveLength(13);
    expect(persisted!.companyId).toBe(makeCanonicalScope().company);
  });
});

describe("T-S4B-001 /drenyra:continue (REQ-CMD-005; SC-CMD-003; REQ-MISS-004)", () => {
	async function startMission(
		ctx: HarnessContext,
		intent: MissionIntent,
	): Promise<string> {
    const command = findCommand(ctx, "drenyra:mission");
    const output = await runHandler(command.handler, intent);
    const machine = parseMachineOutput(output) as { missionId: string };
    return machine.missionId;
  }

  it("fails closed without a complete canonical scope", async () => {
    const ctx = makeHarness();
    const command = findCommand(ctx, "drenyra:continue");
    const output = await runHandler(command.handler, "");
    expect(output).toContain("missing");
  });

  it("advances exactly one phase per invocation and provides no continue-all (SC-CMD-003)", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const missionId = await startMission(ctx, "monthly-close");
    const command = findCommand(ctx, "drenyra:continue");

    const first = await runHandler(command.handler, missionId);
    const firstMachine = parseMachineOutput(first) as {
      phase: string | null;
      status: string;
      advanced: boolean;
      version: number;
      waitReason: string | null;
    };
    expect(firstMachine.phase).toBe("intake");
    expect(firstMachine.advanced).toBe(true);
    expect(firstMachine.status).toBe(AccountingMissionStatus.QUEUED);
    expect(firstMachine.waitReason).toBeNull();
    const versionAfterFirst = firstMachine.version;

    const second = await runHandler(command.handler, missionId);
    const secondMachine = parseMachineOutput(second) as {
      phase: string | null;
      status: string;
      version: number;
    };
    expect(secondMachine.phase).toBe("bind-scope");
    expect(secondMachine.status).toBe(AccountingMissionStatus.RUNNING);
    expect(secondMachine.version).toBe(versionAfterFirst + 1);

    // Exactly one transition per invocation: version bumps by exactly 1.
    const third = await runHandler(command.handler, missionId);
    const thirdMachine = parseMachineOutput(third) as { version: number };
    expect(thirdMachine.version).toBe(secondMachine.version + 1);
  });

  it("WAIT produces a clear message and never auto-advances (REQ-MISS-009)", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const missionId = await startMission(ctx, "monthly-close");
    const command = findCommand(ctx, "drenyra:continue");
    await runHandler(command.handler, missionId); // intake -> QUEUED
    await runHandler(command.handler, missionId); // bind-scope -> RUNNING
    const waitOutput = await runHandler(command.handler, missionId); // ingest -> WAITING_FOR_EVIDENCE
    const waitMachine = parseMachineOutput(waitOutput) as {
      phase: string | null;
      advanced: boolean;
      waitReason: string | null;
      status: string;
    };
    // The ingest phase started but did not complete: the mission entered the
    // engine-legal evidence wait, and no phase is reported as completed.
    expect(waitMachine.phase).toBeNull();
    expect(waitMachine.advanced).toBe(false);
		expect(waitMachine.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);
    expect(waitMachine.waitReason).toBe("EVIDENCE");
    expect(waitOutput).toContain("no auto-advance");

    // A further continue must NOT advance: same status, no phase, clear message.
    const stuck = await runHandler(command.handler, missionId);
    expect(stuck).toContain("waits on EVIDENCE");
    const stuckMachine = parseMachineOutput(stuck) as {
      phase: string | null;
      advanced: boolean;
      waitReason: string | null;
      status: string;
    };
    expect(stuckMachine.phase).toBeNull();
    expect(stuckMachine.advanced).toBe(false);
    expect(stuckMachine.waitReason).toBe("EVIDENCE");
		expect(stuckMachine.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);
  });

  it("continues the active mission for the bound scope when no id is given", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const missionId = await startMission(ctx, "monthly-close");
    const command = findCommand(ctx, "drenyra:continue");
    const output = await runHandler(command.handler, "");
		const machine = parseMachineOutput(output) as {
			missionId: string;
			phase: string | null;
		};
    expect(machine.missionId).toBe(missionId);
    expect(machine.phase).toBe("intake");
  });

  it("reports when no active mission exists for the bound scope", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:continue");
    const output = await runHandler(command.handler, "");
    expect(output).toContain("no active mission");
		const machine = parseMachineOutput(output) as {
			error?: string;
			status?: string;
		};
    expect(machine.error).toBeDefined();
  });

  it("reports an unknown mission id with a structured error", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:continue");
    const output = await runHandler(command.handler, "mission-unknown-001");
    expect(output).toContain("not found");
  });

  it("rejects advancing a mission outside the bound scope (REQ-SCOPE-006 boundary)", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    // Start a mission under the fixture scope, then bind a DIFFERENT company.
    const missionCmd = findCommand(ctx, "drenyra:mission");
    const started = await runHandler(missionCmd.handler, "monthly-close");
		const missionId = (parseMachineOutput(started) as { missionId: string })
			.missionId;
    ctx.store.setCanonicalScope(makeCanonicalScope({ company: "20603083343" }));
    const command = findCommand(ctx, "drenyra:continue");
    const output = await runHandler(command.handler, missionId);
    expect(output).toContain("outside the bound scope");
  });

  it("denies advancing past the bound authority mode (authority binding)", async () => {
		const binding = bindScope(
			makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.ANALYZE }),
		);
		const coordinator = new EdaMissionCoordinator(binding, {
			storesRoot: mkdtempSync(join(tmpdir(), "drenyra-s4b-auth-")),
		});
		await coordinator.start({
			intent: "monthly-close",
			sourceRefs: ["ref://balance-202507"],
		});
    const mission = await coordinator.findActiveMission();
    expect(mission).toBeDefined();
    // intake, bind-scope, ingest, normalize, classify, reconcile, investigate pass
    // (QUERY/INVESTIGATE need at most ANALYZE); the propose phase needs PREPARE.
    let result = await coordinator.advance({ missionId: mission!.id });
    for (let index = 0; index < 6 && result.phase !== null; index += 1) {
      expect(result.authorityDenied).toBeUndefined();
      result = await coordinator.advance({ missionId: mission!.id });
    }
    expect(result.phase).toBe("investigate");
    const versionBeforeDeny = result.mission.version;
    result = await coordinator.advance({ missionId: mission!.id });
    // Nothing advanced: the deny is reported on the prepared step.
    expect(result.phase).toBeNull();
    expect(result.preparedStep?.phase).toBe("propose");
    expect(result.authorityDenied).toBeDefined();
    expect(result.authorityDenied!.actionFamily).toBe("PREPARE_CANDIDATE");
    expect(result.authorityDenied!.requiredMode).toBe(AUTHORITY_MODE.PREPARE);
    // No write happened: version unchanged.
    const after = await coordinator.stores.store.findById(mission!.id);
    expect(after!.version).toBe(versionBeforeDeny);
  });
});

describe("T-S4B-001 lib coordinator: conditional phases skip deterministically", () => {
  it("skips conditional phases without a persisted triggering condition (design §4.3)", async () => {
    const binding = makeScopeBinding();
    const coordinator = new EdaMissionCoordinator(binding, {
      storesRoot: mkdtempSync(join(tmpdir(), "drenyra-s4b-skip-")),
    });
		await coordinator.start({
			intent: "reconciliation",
			sourceRefs: ["ref://ledger-202507"],
		});
    const mission = await coordinator.findActiveMission();
    expect(mission).toBeDefined();
    const advanced: string[] = [];
    let result = await coordinator.advance({ missionId: mission!.id });
    let guard = 0;
    while (result.phase !== null && guard < 20) {
      advanced.push(result.phase);
      expect(result.authorityDenied).toBeUndefined();
      result = await coordinator.advance({ missionId: mission!.id });
      guard += 1;
    }
    // propose/approve/execute are conditional for reconciliation and SKIP;
    // the full flow ends COMPLETED at archive.
    expect(advanced).toContain("propose");
    expect(advanced).toContain("approve");
    expect(advanced).toContain("execute");
    expect(result.mission.status).toBe(AccountingMissionStatus.COMPLETED);
  });
});

describe("T-S4B-002 /drenyra:resume (REQ-CMD-007; SC-CMD-006)", () => {
	async function startAndRun(
		ctx: HarnessContext,
		continues: number,
	): Promise<string> {
    const missionCmd = findCommand(ctx, "drenyra:mission");
    const output = await runHandler(missionCmd.handler, "monthly-close");
    const machine = parseMachineOutput(output) as { missionId: string };
    const missionId = machine.missionId;
    const continueCmd = findCommand(ctx, "drenyra:continue");
    for (let index = 0; index < continues; index += 1) {
      await runHandler(continueCmd.handler, missionId);
    }
    return missionId;
  }

  it("fails closed without a complete canonical scope", async () => {
    const ctx = makeHarness();
    const command = findCommand(ctx, "drenyra:resume");
    const output = await runHandler(command.handler, "mission-x");
    expect(output).toContain("missing");
  });

  it("requires a mission id", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:resume");
    const output = await runHandler(command.handler, "");
    expect(output).toContain("usage");
  });

  it("reports when the mission is not found", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:resume");
    const output = await runHandler(command.handler, "mission-nope");
    expect(output).toContain("not found");
    const machine = parseMachineOutput(output) as { outcome: string };
    expect(machine.outcome).toBe("not-found");
  });

  it("recovers an interrupted RUNNING mission to UNKNOWN via the engine policy", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const missionId = await startAndRun(ctx, 2); // intake, bind-scope -> RUNNING
    const command = findCommand(ctx, "drenyra:resume");
    const output = await runHandler(command.handler, missionId);
    expect(output).toContain("recovered");
    const machine = parseMachineOutput(output) as {
      outcome: string;
      status: string;
      recovery: { recovered: string[] };
    };
    expect(machine.outcome).toBe("recovered");
    expect(machine.status).toBe(AccountingMissionStatus.UNKNOWN);
    expect(machine.recovery.recovered).toContain(missionId);
    // Evidence-based decision: the operator decides the next step; nothing re-ran.
    const binding = makeScopeBinding();
		const coordinator = new EdaMissionCoordinator(binding, {
			storesRoot: ctx.root,
		});
    const persisted = await coordinator.stores.store.findById(missionId);
    expect(persisted!.status).toBe(AccountingMissionStatus.UNKNOWN);
  });

  it("leaves WAITING_FOR_EVIDENCE missions untouched (SC-CMD-006)", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const missionId = await startAndRun(ctx, 3); // -> WAITING_FOR_EVIDENCE
    const command = findCommand(ctx, "drenyra:resume");
    const output = await runHandler(command.handler, missionId);
    expect(output).toContain("preserved");
    const machine = parseMachineOutput(output) as {
      outcome: string;
      status: string;
      recovery: { preserved: string[] };
    };
    expect(machine.outcome).toBe("preserved");
    expect(machine.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
    expect(machine.recovery.preserved).toContain(missionId);
  });

  it("leaves terminal missions untouched (never replayed)", async () => {
    const binding = makeScopeBinding();
    const root = mkdtempSync(join(tmpdir(), "drenyra-s4b-terminal-"));
		const coordinator = new EdaMissionCoordinator(binding, {
			storesRoot: root,
		});
		await coordinator.start({
			intent: "reconciliation",
			sourceRefs: ["ref://ledger-202507"],
		});
    const mission = await coordinator.findActiveMission();
    let result = await coordinator.advance({ missionId: mission!.id });
    let guard = 0;
    while (result.phase !== null && guard < 20) {
      result = await coordinator.advance({ missionId: mission!.id });
      guard += 1;
    }
    expect(result.mission.status).toBe(AccountingMissionStatus.COMPLETED);

    // Reuse the SAME root so the handler sees the terminal mission in the store.
    const ctx = makeHarness(root);
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const command = findCommand(ctx, "drenyra:resume");
    const output = await runHandler(command.handler, mission!.id);
    expect(output).toContain("preserved");
		const machine = parseMachineOutput(output) as {
			outcome: string;
			status: string;
		};
    expect(machine.outcome).toBe("preserved");
    expect(machine.status).toBe(AccountingMissionStatus.COMPLETED);
  });

  it("recovers an already-UNKNOWN mission unchanged (idempotent pass)", async () => {
    const ctx = makeHarness();
    ctx.store.setCanonicalScope(makeCanonicalScope());
    const missionId = await startAndRun(ctx, 2);
    const command = findCommand(ctx, "drenyra:resume");
    await runHandler(command.handler, missionId); // RUNNING -> UNKNOWN (once)
    const binding = makeScopeBinding();
		const coordinator = new EdaMissionCoordinator(binding, {
			storesRoot: ctx.root,
		});
    const before = await coordinator.stores.store.findById(missionId);
    // UNKNOWN missions are decided by evidence (REQ-MISS-007): a second pass
    // preserves the mission untouched and never re-runs it.
    const second = await runHandler(command.handler, missionId);
		const machine = parseMachineOutput(second) as {
			outcome: string;
			status: string;
		};
    expect(machine.outcome).toBe("preserved");
    expect(machine.status).toBe(AccountingMissionStatus.UNKNOWN);
    const after = await coordinator.stores.store.findById(missionId);
    expect(after!.status).toBe(AccountingMissionStatus.UNKNOWN);
    expect(after!.version).toBe(before!.version);
  });
});

describe("T-S4B-003 /drenyra:receipt (REQ-CMD-006; SC-CMD-004/005)", () => {
  function setupScope(ctx: HarnessContext): void {
    ctx.store.setCanonicalScope(makeCanonicalScope());
  }

  it("fails closed without a complete canonical scope", async () => {
    const ctx = makeHarness();
    const command = findCommand(ctx, "drenyra:receipt");
    const output = await runHandler(command.handler, "verify abc");
    expect(output).toContain("missing");
  });

  it("shows a stored receipt by id", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const binding = makeScopeBinding();
    const fixture = makeHarnessReceiptRecord(binding);
    await new ReceiptStore(ctx.root).save(fixture.record);
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			fixture.record.receipt.receiptHash,
		);
    expect(output).toContain(fixture.record.receipt.receiptHash);
    const machine = parseMachineOutput(output) as {
      command: string;
      receiptHash: string;
      receipt: { receiptType: string; signerKeyId: string };
    };
    expect(machine.command).toBe("receipt");
    expect(machine.receiptHash).toBe(fixture.record.receipt.receiptHash);
    expect(machine.receipt.receiptType).toBe("APPROVAL");
		expect(machine.receipt.signerKeyId).toBe(
			fixture.record.receipt.signerKeyId,
		);
  });

  it("reports usage when no id is given", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const command = findCommand(ctx, "drenyra:receipt");
    const output = await runHandler(command.handler, "");
    expect(output).toContain("usage");
  });

  it("verify: valid receipt reports content-valid, signature-valid, signer-trusted, in-currency with the bound scope and target (SC-CMD-004)", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const binding = makeScopeBinding();
    const fixture = makeHarnessReceiptRecord(binding);
    await seedReceiptAndKey(ctx.root, fixture);
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${fixture.record.receipt.receiptHash}`,
		);
    expect(output).toContain("VALID");
    const machine = parseMachineOutput(output) as {
      command: string;
      valid: boolean;
      engineStatus: string;
      bindingValid: boolean;
      scopeValid: boolean;
      targetValid: boolean;
      reasons: string[];
    };
    expect(machine.command).toBe("receipt:verify");
    expect(machine.valid).toBe(true);
    expect(machine.engineStatus).toBe("SIGNER_TRUSTED");
    expect(machine.bindingValid).toBe(true);
    expect(machine.scopeValid).toBe(true);
    expect(machine.targetValid).toBe(true);
    expect(machine.reasons).toEqual([]);
  });

  it("verify: tampered receipt is rejected with a reason (SC-CMD-005)", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const binding = makeScopeBinding();
    const fixture = makeHarnessReceiptRecord(binding);
    // Tamper AFTER signing: mutate the signed content.
    fixture.record = {
      ...fixture.record,
			receipt: {
				...fixture.record.receipt,
				content: { ...fixture.record.receipt.content, decision: "REJECT" },
			},
    };
    await seedReceiptAndKey(ctx.root, fixture);
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${fixture.record.receipt.receiptHash}`,
		);
    expect(output).not.toContain(": VALID");
    const machine = parseMachineOutput(output) as {
      valid: boolean;
      engineStatus: string;
      reasons: string[];
    };
    expect(machine.valid).toBe(false);
    expect(machine.engineStatus).toBe("PAYLOAD_TAMPERED");
    expect(machine.reasons.length).toBeGreaterThan(0);
  });

  it("verify: unknown-signer receipt is rejected (SC-CMD-005)", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const binding = makeScopeBinding();
    const fixture = makeHarnessReceiptRecord(binding);
    // Persist the record but NOT the trusted key -> UNKNOWN_SIGNER.
    await new ReceiptStore(ctx.root).save(fixture.record);
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${fixture.record.receipt.receiptHash}`,
		);
		const machine = parseMachineOutput(output) as {
			valid: boolean;
			engineStatus: string;
		};
    expect(machine.valid).toBe(false);
    expect(machine.engineStatus).toBe("UNKNOWN_SIGNER");
  });

  it("verify: expired-key receipt is rejected (SC-CMD-005)", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const binding = makeScopeBinding();
    const fixture = makeHarnessReceiptRecord(binding);
    const expiredKey: SigningKeyInfo = {
      keyId: fixture.key.keyId,
      publicKey: fixture.key.publicKey,
      issuedAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2021-01-01T00:00:00.000Z",
    };
		await seedReceiptAndKey(ctx.root, {
			record: fixture.record,
			key: expiredKey,
		});
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${fixture.record.receipt.receiptHash}`,
		);
		const machine = parseMachineOutput(output) as {
			valid: boolean;
			engineStatus: string;
		};
    expect(machine.valid).toBe(false);
    expect(machine.engineStatus).toBe("KEY_EXPIRED");
  });

  it("verify: revoked-key receipt is rejected (SC-CMD-005)", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const binding = makeScopeBinding();
    const fixture = makeHarnessReceiptRecord(binding);
    const revokedKey: SigningKeyInfo = {
      keyId: fixture.key.keyId,
      publicKey: fixture.key.publicKey,
      issuedAt: "2020-01-01T00:00:00.000Z",
      revokedAt: "2026-06-01T00:00:00.000Z",
    };
		await seedReceiptAndKey(ctx.root, {
			record: fixture.record,
			key: revokedKey,
		});
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${fixture.record.receipt.receiptHash}`,
		);
		const machine = parseMachineOutput(output) as {
			valid: boolean;
			engineStatus: string;
		};
    expect(machine.valid).toBe(false);
    expect(machine.engineStatus).toBe("KEY_REVOKED");
  });

  it("verify: a receipt bound to a different scope is rejected with a scope reason", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const wrongBinding = makeScopeBinding({ tenant: "other-tenant" });
    const fixture = makeHarnessReceiptRecord(wrongBinding);
    await seedReceiptAndKey(ctx.root, fixture);
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${fixture.record.receipt.receiptHash}`,
		);
    const machine = parseMachineOutput(output) as {
      valid: boolean;
      scopeValid: boolean;
      reasons: string[];
    };
    expect(machine.valid).toBe(false);
    expect(machine.scopeValid).toBe(false);
    expect(machine.reasons.join(" ")).toContain("scope");
  });

  it("verify: unknown receipt id is reported not found", async () => {
    const ctx = makeHarness();
    setupScope(ctx);
    const command = findCommand(ctx, "drenyra:receipt");
		const output = await runHandler(
			command.handler,
			`verify ${"0".repeat(64)}`,
		);
    expect(output).toContain("not found");
  });

      it("verify: usage error when the subcommand lacks an id", async () => {
        const ctx = makeHarness();
        setupScope(ctx);
        const command = findCommand(ctx, "drenyra:receipt");
        const output = await runHandler(command.handler, "verify");
        expect(output).toContain("usage");
      });
    });

    /**
     * pi-sdd-030-routing-adapter — focused seam regression assertion (design D6
     * §8.1). Proves the durable routing seam drives ONE advance without changing
     * the existing `EdaMissionCoordinator` lifecycle: the mission advances exactly
     * one phase through the seam, and a direct `coordinator.advance` afterwards
     * still behaves exactly as before (one phase per call).
     */
    describe("durable routing seam regression (pi-sdd-030)", () => {
      it("maps one advance without changing the existing coordinator lifecycle", async () => {
        const root = mkdtempSync(join(tmpdir(), "pi-extension-seam-"));
        const binding = bindScope(makeCanonicalScope());
        const coordinator = new EdaMissionCoordinator(binding, { storesRoot: root });
        const mission = await coordinator.start({
          intent: "monthly-close",
          sourceRefs: [],
        });
        const input: WorkUnitInput = {
          id: `work-${mission.id}`,
          objective: "seam regression objective",
          scope: { tenantId: binding.scope.tenant, ruc: binding.scope.company },
          evidenceAllowed: [{ algorithm: "sha256", hash: "a".repeat(64) as `x${string}` & { readonly __brand: "Sha256Hash" } }],
          skills: [],
          policies: [{ id: "policies.v1", version: "1.0.0" }],
          authorizedTools: [{ id: "chain-pipeline", version: "0.3.0", operations: ["execute-step"] }],
          authorizedDestinations: [{ kind: "EVIDENCE_STORE", id: "evidence" }],
          outputSchema: {
            id: "schema",
            version: "1.0.0",
            contentHash: "b".repeat(64) as `x${string}` & { readonly __brand: "Sha256Hash" },
          },
          budgets: {
            timeLimitMs: 60_000 as never,
            tokenLimit: 100_000 as never,
            costLimitCents: 1_000_000n,
            researchAttemptLimit: 3,
            correctionAttemptLimit: 1,
          },
          successConditions: [{ kind: "EVIDENCE_HASHES_PRESENT", required: ["a".repeat(64) as `x${string}` & { readonly __brand: "Sha256Hash" }] }],
          stopConditions: ["BUDGET_EXHAUSTED"],
        };
        const created = createWorkUnit(mission, input);
        if (!created.ok) throw new Error(JSON.stringify(created.issues));
        const workUnit: WorkUnit = created.value;
        const ledger = BudgetLedger.create(workUnit);

        const port = createDurableMissionRoutingPort(coordinator);
        const response = await port({
          workUnit,
          route: "durable",
          binding,
          mission,
          chain: {
            name: "stub",
            intent: "monthly-close",
            requiredMode: "EXECUTE",
            runStep: async () => ({ output: null }),
          } as never,
          chainRun: { binding, input: {} },
          ledger,
        });
        // Exactly one phase advanced through the seam.
        expect(response.missionAfter.status).toBe(AccountingMissionStatus.QUEUED);
        const afterSeam = await coordinator.stores.store.findById(mission.id);
        expect(
          afterSeam?.steps.filter((step) => step.status === "COMPLETED"),
        ).toHaveLength(1);

        // Existing lifecycle unchanged: a direct advance still runs one phase.
        const direct = await coordinator.advance({ missionId: mission.id });
        expect(direct.mission.status).toBe(AccountingMissionStatus.RUNNING);
        const afterDirect = await coordinator.stores.store.findById(mission.id);
        expect(
          afterDirect?.steps.filter((step) => step.status === "COMPLETED"),
        ).toHaveLength(2);
      });
    });
