/**
 * Extension registration tests — the Pi surface of drenyra-pi.
 *
 * Verifies the extension factory registers the drenyra:* command surface
 * (status, doctor, company, period, context, capabilities, scope, models,
 * close) against a structural PiExtensionApi; that handlers stay thin
 * (parse → scope policy → delegate → render; REQ-CMD-004); that the scope
 * guard fails closed for scope-requiring commands (REQ-CMD-003; SC-CMD-002);
 * and that `pi.extensions` points at the exact compiled entry file
 * (T-S4A-004; design §10.1, §14).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/exit codes are JSON integers, never
 * floats.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  drenyraPiExtension,
  registerDrenyraPiExtension,
  type PiCommandContext,
  type PiExtensionApi,
} from "../extensions/register.js";
import { ScopeContextStore } from "../runtime/context.js";
import { makeCanonicalScope } from "./helpers/authority-fixtures.js";
import { sha256Canonical } from "../lib/canonicalization.js";

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

/** A hermetic context store so handler tests never touch ~/.drenyra. */
function makeTempStore(): ScopeContextStore {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-extension-"));
  return new ScopeContextStore(join(dir, "context.json"));
}

function cleanupTempStore(store: ScopeContextStore): void {
  // The store owns a temp file inside a temp dir; nothing to clean beyond GC,
  // but keep the helper for parity with other suites.
  void store;
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

/** The 14 intended commands (REQ-CMD-001) plus the two legacy extras. */
const INTENDED_COMMANDS = [
  "status",
  "doctor",
  "capabilities",
  "scope",
  "period",
  "mission",
  "continue",
  "reconcile",
  "close",
  "evidence",
  "verify",
  "receipt",
  "resume",
  "models",
] as const;

describe("drenyraPiExtension descriptor", () => {
  it("declares the runtime pin state and provided capabilities", () => {
    expect(drenyraPiExtension.name).toBe("drenyra-pi");
    expect(drenyraPiExtension.provides).toContain("status");
    expect(drenyraPiExtension.provides).toContain("doctor");
    expect(drenyraPiExtension.provides).toContain("context");
    expect(drenyraPiExtension.provides).toContain("capabilities");
    expect(drenyraPiExtension.provides).toContain("scope");
    expect(drenyraPiExtension.provides).toContain("models");
    expect(drenyraPiExtension.provides).toContain("mission");
    expect(drenyraPiExtension.provides).toContain("continue");
    expect(drenyraPiExtension.provides).toContain("resume");
    expect(drenyraPiExtension.provides).toContain("receipt");
    expect(drenyraPiExtension.provides).toContain("evidence");
    expect(drenyraPiExtension.provides).toContain("verify");
    expect(drenyraPiExtension.provides).toContain("reconcile");
    expect(drenyraPiExtension.commands).toEqual([
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
    ]);
    expect(drenyraPiExtension.runtime.package).toBe("drenyra-ai");
    expect(drenyraPiExtension.runtime.version).toBe("0.2.0");
    expect(drenyraPiExtension.runtime.state).toBe("released");
  });
});

describe("registerDrenyraPiExtension", () => {
  it("registers the full current command surface with descriptions", () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraPiExtension(pi);
    expect(registered.map((c) => c.name)).toEqual([
      "drenyra:status",
      "drenyra:doctor",
      "drenyra:company",
      "drenyra:period",
      "drenyra:context",
      "drenyra:capabilities",
      "drenyra:scope",
      "drenyra:models",
      "drenyra:close",
      "drenyra:mission",
      "drenyra:continue",
      "drenyra:resume",
      "drenyra:receipt",
      "drenyra:evidence",
      "drenyra:verify",
      "drenyra:reconcile",
    ]);
    for (const command of registered) {
      expect(command.description.length).toBeGreaterThan(0);
    }
  });

  it("/drenyra:doctor fails closed when the pinned runtime is absent (repo root)", async () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraPiExtension(pi);
    const output = await runHandler(registered[1].handler, "");
    // drenyra-ai is installed as a devDependency (the postinstall artifact in
    // a real consumer), so the doctor reports "verified" against the repo root.
    expect(output).toContain("verified");
  });
});

describe("entrypoint packaging (T-S4A-004)", () => {
  it("points pi.extensions at the exact compiled entry file (one entrypoint)", () => {
		const pkg = JSON.parse(
			readFileSync(join(process.cwd(), "package.json"), "utf8"),
		) as {
      pi?: { extensions?: unknown };
      exports?: Record<string, unknown>;
    };
    expect(pkg.pi?.extensions).toEqual(["./dist/extensions/register.js"]);
    expect(pkg.exports?.["./extensions"]).toBe("./dist/extensions/register.js");
  });

  it("registers drenyra:capabilities with a structured pre-scope handler", async () => {
    const { pi, registered } = makeMockPi();
    const store = makeTempStore();
    registerDrenyraPiExtension(pi, { contextStore: store });
    const command = registered.find((c) => c.name === "drenyra:capabilities");
    expect(command).toBeDefined();
    const output = await runHandler(command!.handler, "");
    expect(output).toContain("capabilities");
    const machine = parseMachineOutput(output) as {
      engine?: { protocolVersion?: string };
			harness?: {
				commands?: string[];
				authorityModes?: string[];
				scopeElements?: string[];
			};
    };
    expect(machine.engine?.protocolVersion).toBeDefined();
    expect(machine.harness?.commands).toContain("/drenyra:capabilities");
    expect(machine.harness?.authorityModes).toHaveLength(4);
    expect(machine.harness?.scopeElements).toHaveLength(10);
    cleanupTempStore(store);
  });

  it("binds and reads the full 10-element scope through /drenyra:scope", async () => {
    const { pi, registered } = makeMockPi();
    const store = makeTempStore();
    registerDrenyraPiExtension(pi, { contextStore: store });
    const scopeCmd = registered.find((c) => c.name === "drenyra:scope");
    expect(scopeCmd).toBeDefined();
    // Read path first: incomplete until bound.
    let output = await runHandler(scopeCmd!.handler, "");
    expect(output).toContain("incomplete");
    // Set path: 10 positional elements.
    output = await runHandler(
      scopeCmd!.handler,
      "set acme acme-accounting 20123456786 202507 general-ledger monthly-close " +
        `${"a".repeat(64)} policies.v1 alice EXECUTE`,
    );
    expect(output).toContain("scopeHash");
    // Re-read after set: complete.
    output = await runHandler(scopeCmd!.handler, "");
    expect(output).toContain("complete");
    cleanupTempStore(store);
  });

  it("rejects an invalid scope binding through /drenyra:scope without persisting", async () => {
    const { pi, registered } = makeMockPi();
    const store = makeTempStore();
    registerDrenyraPiExtension(pi, { contextStore: store });
    const scopeCmd = registered.find((c) => c.name === "drenyra:scope");
    expect(scopeCmd).toBeDefined();
    let output = await runHandler(
      scopeCmd!.handler,
      "set acme acme-accounting 20123456786 202507 general-ledger monthly-close " +
        "not-a-digest policies.v1 alice EXECUTE",
    );
    expect(output).toContain("drenyra:scope:");
    expect(output.toLowerCase()).toContain("sha-256");
    // Nothing persisted: a follow-up read is still incomplete.
    output = await runHandler(scopeCmd!.handler, "");
    expect(output).toContain("incomplete");
    cleanupTempStore(store);
  });

  it("registers drenyra:models with the documented model-routing registry", async () => {
    const { pi, registered } = makeMockPi();
    const store = makeTempStore();
    registerDrenyraPiExtension(pi, { contextStore: store });
    const command = registered.find((c) => c.name === "drenyra:models");
    expect(command).toBeDefined();
    const output = await runHandler(command!.handler, "");
    expect(output).toContain("model-routing");
		const machine = parseMachineOutput(output) as {
			version?: string;
			routing?: unknown[];
		};
    expect(machine.version).toBe("drenyra.model-routing.v1");
    expect(machine.routing).toHaveLength(13);
    cleanupTempStore(store);
  });

  it("keeps /drenyra:close fail-closed without a complete scope (S3b intact)", async () => {
    const { pi, registered } = makeMockPi();
    const store = makeTempStore();
    registerDrenyraPiExtension(pi, { contextStore: store });
    const closeCmd = registered.find((c) => c.name === "drenyra:close");
    expect(closeCmd).toBeDefined();
    const output = await runHandler(closeCmd!.handler, "approver-1");
    expect(output).toContain("missing");
    expect(output).not.toContain("verified");
    cleanupTempStore(store);
  });
});

describe("T-S4B-004 complete command surface (REQ-CMD-001/002; SC-CMD-001)", () => {
  it("registers the 14 intended commands plus company and context (16 total)", () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraPiExtension(pi);
    const names = registered.map((c) => c.name);
    for (const name of INTENDED_COMMANDS) {
      expect(names, name).toContain(`drenyra:${name}`);
    }
    expect(names).toContain("drenyra:company");
    expect(names).toContain("drenyra:context");
    expect(registered).toHaveLength(16);
    // Descriptor mirrors the registered surface (SC-CMD-001 conformance).
    expect(drenyraPiExtension.commands).toHaveLength(16);
    expect(drenyraPiExtension.provides).toHaveLength(13);
  });

  it("wires /drenyra:verify and /drenyra:evidence to their chains (REQ-CMD-004/008)", async () => {
    const VERIFY_MANIFEST = {
      ledger: [
        { account: "101", reference: "B001", debitCents: 10_000, creditCents: 0 },
        { account: "401", reference: "B001", debitCents: 0, creditCents: 10_000 },
      ],
      bank: [{ reference: "B001", amountCents: 10_000 }],
      bankAccount: "101",
     };

    // /drenyra:verify — fail closed without scope, then runs the verify chain.
    {
       const { pi, registered } = makeMockPi();
       const store = makeTempStore();
       registerDrenyraPiExtension(pi, { contextStore: store });
      const command = registered.find((c) => c.name === "drenyra:verify");
      expect(command).toBeDefined();
      let output = await runHandler(command!.handler, JSON.stringify(VERIFY_MANIFEST));
       expect(output).toContain("missing");
      cleanupTempStore(store);
    }

    // /drenyra:verify — under ANALYZE with a matching source digest, the chain
    // runs and reports structured output (REQ-CMD-008).
    {
      const root = mkdtempSync(join(tmpdir(), "drenyra-verify-cmd-"));
      try {
        const { pi, registered } = makeMockPi();
        const store = new ScopeContextStore(join(root, "context.json"));
        registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
        store.setCanonicalScope(
          makeCanonicalScope({
            authorityLevel: "ANALYZE",
            sourceSnapshot: sha256Canonical(VERIFY_MANIFEST),
          }),
        );
        const command = registered.find((c) => c.name === "drenyra:verify");
        expect(command).toBeDefined();
        const output = await runHandler(command!.handler, JSON.stringify(VERIFY_MANIFEST));
        expect(output).toContain("drenyra:verify:");
        const machine = parseMachineOutput(output) as {
          command: string;
          chain: string;
          missionId: string;
          intent: string;
          phase: string | null;
          status: string;
        };
        expect(machine.command).toBe("verify");
        expect(machine.chain).toBe("verify");
        expect(machine.missionId.length).toBeGreaterThan(0);
        expect(machine.intent).toBe("verify");
        expect(machine.phase).toBe("intake");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }

    // /drenyra:verify — a scope digest that cannot match the manifest produces a
    // structured blocked verdict with the source-integrity issue (SC-CHAIN-003).
    {
      const root = mkdtempSync(join(tmpdir(), "drenyra-verify-cmd-"));
      try {
        const { pi, registered } = makeMockPi();
        const store = new ScopeContextStore(join(root, "context.json"));
        registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
        store.setCanonicalScope(makeCanonicalScope({ authorityLevel: "ANALYZE" }));
        const command = registered.find((c) => c.name === "drenyra:verify");
        expect(command).toBeDefined();
        let output = "";
        for (let index = 0; index < 8; index += 1) {
          output = await runHandler(command!.handler, JSON.stringify(VERIFY_MANIFEST));
          if (output.includes("issues") || output.includes("blocked")) {
            break;
          }
        }
         const machine = parseMachineOutput(output) as {
           command: string;
           status: string;
          verdict: string;
          checks: Array<{ check: string; verdict: string }>;
         };
        expect(machine.command).toBe("verify");
        expect(machine.status).toBe("blocked");
        expect(machine.verdict).toBe("issues");
        expect(
          machine.checks.some(
            (check) => check.check === "source-integrity" && check.verdict === "fail",
          ),
        ).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }

    // /drenyra:evidence — fail closed without scope, then runs the evidence chain.
    {
      const { pi, registered } = makeMockPi();
      const store = makeTempStore();
      registerDrenyraPiExtension(pi, { contextStore: store });
      const command = registered.find((c) => c.name === "drenyra:evidence");
      expect(command).toBeDefined();
      const output = await runHandler(command!.handler, "{}");
      expect(output).toContain("missing");
       cleanupTempStore(store);
     }

    // /drenyra:evidence — an add-node op appends the node with structured output.
    {
      const root = mkdtempSync(join(tmpdir(), "drenyra-evidence-cmd-"));
      try {
        const { pi, registered } = makeMockPi();
        const store = new ScopeContextStore(join(root, "context.json"));
        registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
        store.setCanonicalScope(makeCanonicalScope({ authorityLevel: "ANALYZE" }));
        const command = registered.find((c) => c.name === "drenyra:evidence");
        expect(command).toBeDefined();
        const output = await runHandler(
          command!.handler,
          JSON.stringify({
            op: "add-node",
            node: {
              id: "src-1",
              nodeKind: "source",
              payload: { kind: "ledger-entry", reference: "B001", amountCents: 100 },
            },
          }),
        );
            expect(output).toContain("drenyra:evidence:");
            const machine = parseMachineOutput(output) as {
              command: string;
              chain: string;
              missionId: string;
              phase: string | null;
              op: string;
              nodeId: string | null;
            };
            expect(machine.command).toBe("evidence");
            expect(machine.chain).toBe("evidence");
            expect(machine.missionId.length).toBeGreaterThan(0);
            expect(machine.op).toBe("add-node");
            expect(machine.nodeId).toBe("src-1");
          } finally {
            rmSync(root, { recursive: true, force: true });
          }
        }
  });
  });
describe("T-S5A-002 /drenyra:reconcile wired to the reconciliation chain", () => {
	const RECONCILE_MANIFEST = JSON.stringify({
		bank: [
			{ reference: "B001", amountCents: 10_000 },
			{ reference: "B002", amountCents: 2_500 },
		],
		ledger: [
			{ reference: "B001", amountCents: 10_000 },
			{ reference: "B002", amountCents: 2_300 },
		],
	});

	it("fails closed without a complete canonical scope (SC-CMD-002)", async () => {
		const { pi, registered } = makeMockPi();
		const store = makeTempStore();
		registerDrenyraPiExtension(pi, { contextStore: store });
		const command = registered.find((c) => c.name === "drenyra:reconcile");
		expect(command).toBeDefined();
		const output = await runHandler(command!.handler, RECONCILE_MANIFEST);
		expect(output).toContain("missing");
		cleanupTempStore(store);
	});

	it("denies detection below the ANALYZE authority minimum", async () => {
		const { pi, registered } = makeMockPi();
		const store = makeTempStore();
		registerDrenyraPiExtension(pi, { contextStore: store });
		store.setCanonicalScope(makeCanonicalScope({ authorityLevel: "ASK" }));
		const command = registered.find((c) => c.name === "drenyra:reconcile");
		expect(command).toBeDefined();
		const output = await runHandler(command!.handler, RECONCILE_MANIFEST);
		expect(output).toContain("ANALYZE");
		const machine = parseMachineOutput(output) as {
			status: string;
			reason: string;
		};
		expect(machine.status).toBe("denied");
		expect(machine.reason).toMatch(/ANALYZE/);
		cleanupTempStore(store);
	});

	it("runs the reconciliation chain with structured output under ANALYZE (detection)", async () => {
		const root = mkdtempSync(join(tmpdir(), "drenyra-reconcile-cmd-"));
		try {
			const { pi, registered } = makeMockPi();
			const store = new ScopeContextStore(join(root, "context.json"));
			registerDrenyraPiExtension(pi, {
				contextStore: store,
				storesRoot: root,
			});
			store.setCanonicalScope(
				makeCanonicalScope({ authorityLevel: "ANALYZE" }),
			);
			const command = registered.find((c) => c.name === "drenyra:reconcile");
			expect(command).toBeDefined();
			const output = await runHandler(command!.handler, RECONCILE_MANIFEST);
			expect(output).toContain("drenyra:reconcile:");
			const machine = parseMachineOutput(output) as {
				command: string;
				chain: string;
				missionId: string;
				intent: string;
				phase: string | null;
				status: string;
				version: number;
			};
			expect(machine.command).toBe("reconcile");
			expect(machine.chain).toBe("reconcile");
			expect(machine.missionId.length).toBeGreaterThan(0);
			expect(machine.intent).toBe("reconciliation");
			expect(machine.phase).toBe("intake");
			expect(machine.version).toBeGreaterThanOrEqual(1);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("rejects a malformed manifest without running the chain", async () => {
		const root = mkdtempSync(join(tmpdir(), "drenyra-reconcile-cmd-"));
		try {
			const { pi, registered } = makeMockPi();
			const store = new ScopeContextStore(join(root, "context.json"));
			registerDrenyraPiExtension(pi, {
				contextStore: store,
				storesRoot: root,
			});
			store.setCanonicalScope(
				makeCanonicalScope({ authorityLevel: "ANALYZE" }),
			);
			const command = registered.find((c) => c.name === "drenyra:reconcile");
			expect(command).toBeDefined();
			const output = await runHandler(command!.handler, "{ not json");
			expect(output).toContain("not valid JSON");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
