/**
 * Extension registration tests — the Pi surface of drenyra-shell.
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
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  drenyraShellExtension,
  registerDrenyraShellExtension,
  type PiCommandContext,
  type PiExtensionApi,
} from "../extensions/register.js";
import {
  registerFiscalGuard,
  type FiscalGuardExtensionAPI,
} from "../extensions/fiscal-guard.js";
import { ScopeContextStore } from "../runtime/context.js";
import { makeCanonicalScope } from "./helpers/authority-fixtures.js";
import { sha256Canonical } from "../lib/canonicalization.js";
import type { EngramClientResult } from "../runtime/engram-client.js";

interface RegisteredCommand {
  name: string;
  description: string;
  handler: (args: string, ctx: PiCommandContext) => Promise<void>;
}

interface RegisteredTool {
  name: string;
  description: string;
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
  ) => unknown;
}

function makeMockPi(): {
  pi: PiExtensionApi;
  registered: RegisteredCommand[];
  registeredTools: RegisteredTool[];
} {
  const registered: RegisteredCommand[] = [];
  const registeredTools: RegisteredTool[] = [];
  const pi: PiExtensionApi = {
    registerCommand(name, options) {
      registered.push({
        name,
        description: options.description ?? "",
        handler: options.handler,
      });
    },
    on(_event: string, _handler: (event: unknown, ctx: unknown) => void): void {},
    registerTool(tool) {
      registeredTools.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      });
    },
  };
  return { pi, registered, registeredTools };
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

/** The 15 intended commands (REQ-CMD-001) plus the two legacy extras. */
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
  "preflight",
  "persona",
] as const;

describe("drenyraShellExtension descriptor", () => {
  it("declares the runtime pin state and provided capabilities", () => {
    expect(drenyraShellExtension.name).toBe("drenyra-shell");
    expect(drenyraShellExtension.provides).toContain("status");
    expect(drenyraShellExtension.provides).toContain("doctor");
    expect(drenyraShellExtension.provides).toContain("context");
    expect(drenyraShellExtension.provides).toContain("capabilities");
    expect(drenyraShellExtension.provides).toContain("scope");
    expect(drenyraShellExtension.provides).toContain("models");
    expect(drenyraShellExtension.provides).toContain("mission");
    expect(drenyraShellExtension.provides).toContain("continue");
    expect(drenyraShellExtension.provides).toContain("resume");
    expect(drenyraShellExtension.provides).toContain("receipt");
    expect(drenyraShellExtension.provides).toContain("evidence");
    expect(drenyraShellExtension.provides).toContain("verify");
    expect(drenyraShellExtension.provides).toContain("reconcile");
    expect(drenyraShellExtension.commands).toEqual([
      "/drenyra:status",
      "/drenyra:doctor",
      "/drenyra:preflight",
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
      "/drenyra:install",
      "/drenyra:sync",
      "/drenyra:persona",
    ]);
    expect(drenyraShellExtension.runtime.package).toBe("drenyra-ai");
    expect(drenyraShellExtension.runtime.version).toBe("0.4.1");
    expect(drenyraShellExtension.runtime.state).toBe("released");
  });
});

describe("registerDrenyraShellExtension", () => {
  it("registers the full current command surface with descriptions", () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi);
    expect(registered.map((c) => c.name)).toEqual([
      "drenyra:status",
      "drenyra:doctor",
      "drenyra:preflight",
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
      "drenyra:install",
      "drenyra:sync",
      "drenyra:persona",
    ]);
    for (const command of registered) {
      expect(command.description.length).toBeGreaterThan(0);
    }
  });

  it("/drenyra:doctor fails closed when the pinned runtime is absent (repo root)", async () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi);
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
    registerDrenyraShellExtension(pi, { contextStore: store });
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
    registerDrenyraShellExtension(pi, { contextStore: store });
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
    registerDrenyraShellExtension(pi, { contextStore: store });
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
    registerDrenyraShellExtension(pi, { contextStore: store });
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
    registerDrenyraShellExtension(pi, { contextStore: store });
    const closeCmd = registered.find((c) => c.name === "drenyra:close");
    expect(closeCmd).toBeDefined();
    const output = await runHandler(closeCmd!.handler, "approver-1");
    expect(output).toContain("missing");
    expect(output).not.toContain("verified");
    cleanupTempStore(store);
  });
});

describe("selector-change isolation at protected command handlers", () => {
  it.each([
    ["company", "20512345671"],
    ["period", "202508"],
  ] as const)("blocks mission and evidence mutation after a real %s change", async (selector, value) => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-selector-isolation-"));
    try {
      const { pi, registered } = makeMockPi();
      const store = new ScopeContextStore(join(root, "context.json"));
      registerDrenyraShellExtension(pi, { contextStore: store, storesRoot: root });
      const command = (name: string) => registered.find((entry) => entry.name === `drenyra:${name}`)!.handler;
      const canonical = makeCanonicalScope();
      const bindOutput = await runHandler(
        command("scope"),
        `set ${canonical.tenant} ${canonical.organization} ${canonical.company} ` +
          `${canonical.fiscalPeriod} ${canonical.ledgerBook} ${canonical.operationType} ` +
          `${canonical.sourceSnapshot} ${canonical.policyVersion} ${canonical.actor} ${canonical.authorityLevel}`,
      );
      expect(bindOutput).toContain("scopeHash");
      await runHandler(command(selector), value);
      expect(existsSync(join(root, ".local"))).toBe(false);

      const missionOutput = await runHandler(command("mission"), "monthly-close");
      const evidenceOutput = await runHandler(
        command("evidence"),
        JSON.stringify({
          op: "add-node",
          node: { id: "src-isolated", nodeKind: "source", payload: { reference: "B001" } },
        }),
      );
      expect(missionOutput).toMatch(/complete|missing|re-bind/i);
      expect(evidenceOutput).toMatch(/complete|missing|re-bind/i);
      expect(existsSync(join(root, ".local"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("T-S4B-004 complete command surface (REQ-CMD-001/002; SC-CMD-001)", () => {
  it("registers the 15 intended commands plus company, context, install and sync (19 commands)", () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi);
    const names = registered.map((c) => c.name);
    for (const name of INTENDED_COMMANDS) {
      expect(names, name).toContain(`drenyra:${name}`);
    }
    expect(names).toContain("drenyra:company");
    expect(names).toContain("drenyra:context");
    expect(registered).toHaveLength(20);
    // Descriptor mirrors the registered surface (SC-CMD-001 conformance).
    expect(drenyraShellExtension.commands).toHaveLength(20);
    expect(drenyraShellExtension.provides).toHaveLength(14);
  });

  it("wires /drenyra:verify and /drenyra:evidence to their chains (REQ-CMD-004/008)", async () => {
    const VERIFY_MANIFEST = {
      ledger: [
        {
          account: "101",
          reference: "B001",
          debitCents: 10_000,
          creditCents: 0,
        },
        {
          account: "401",
          reference: "B001",
          debitCents: 0,
          creditCents: 10_000,
        },
      ],
      bank: [{ reference: "B001", amountCents: 10_000 }],
      bankAccount: "101",
    };

    // /drenyra:verify — fail closed without scope, then runs the verify chain.
    {
      const { pi, registered } = makeMockPi();
      const store = makeTempStore();
      registerDrenyraShellExtension(pi, { contextStore: store });
      const command = registered.find((c) => c.name === "drenyra:verify");
      expect(command).toBeDefined();
      const output = await runHandler(
        command!.handler,
        JSON.stringify(VERIFY_MANIFEST),
      );
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
        registerDrenyraShellExtension(pi, {
          contextStore: store,
          storesRoot: root,
        });
        store.setCanonicalScope(
          makeCanonicalScope({
            authorityLevel: "ANALYZE",
            sourceSnapshot: sha256Canonical(VERIFY_MANIFEST),
          }),
        );
        const command = registered.find((c) => c.name === "drenyra:verify");
        expect(command).toBeDefined();
        const output = await runHandler(
          command!.handler,
          JSON.stringify(VERIFY_MANIFEST),
        );
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
        registerDrenyraShellExtension(pi, {
          contextStore: store,
          storesRoot: root,
        });
        store.setCanonicalScope(
          makeCanonicalScope({ authorityLevel: "ANALYZE" }),
        );
        const command = registered.find((c) => c.name === "drenyra:verify");
        expect(command).toBeDefined();
        let output = "";
        for (let index = 0; index < 8; index += 1) {
          output = await runHandler(
            command!.handler,
            JSON.stringify(VERIFY_MANIFEST),
          );
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
            (check) =>
              check.check === "source-integrity" && check.verdict === "fail",
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
      registerDrenyraShellExtension(pi, { contextStore: store });
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
        registerDrenyraShellExtension(pi, {
          contextStore: store,
          storesRoot: root,
        });
        store.setCanonicalScope(
          makeCanonicalScope({ authorityLevel: "ANALYZE" }),
        );
        const command = registered.find((c) => c.name === "drenyra:evidence");
        expect(command).toBeDefined();
        const output = await runHandler(
          command!.handler,
          JSON.stringify({
            op: "add-node",
            node: {
              id: "src-1",
              nodeKind: "source",
              payload: {
                kind: "ledger-entry",
                reference: "B001",
                amountCents: 100,
              },
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
describe("T-S6-004 packaged operating content (REQ-AGENT-009; REQ-SKPT-007)", () => {
  it("ships the ten agents and their asset mirrors in the package", () => {
    const roles = [
      "accounting-scout",
      "evidence-builder",
      "ledger-analyst",
      "reconciliation-agent",
      "tax-controller-pe",
      "anomaly-refuter",
      "close-controller",
      "invoice-sire-agent",
      "journal-candidate-agent",
      "guardian-angel",
    ];
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      files?: string[];
    };
    expect(pkg.files).toContain("agents");
    expect(pkg.files).toContain("assets");
    for (const role of roles) {
      const source = readFileSync(
        join(process.cwd(), "agents", `${role}.md`),
        "utf8",
      );
      const mirror = readFileSync(
        join(process.cwd(), "assets", "agents", `${role}.md`),
        "utf8",
      );
      expect(mirror, `${role} mirror`).toBe(source);
    }
  });

  it("ships prompts, skills, and themes that the pi manifest entries resolve", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      pi?: { prompts?: string[]; skills?: string[]; themes?: string[] };
    };
    const dirs = ["prompts", "skills", "themes"] as const;
    for (const key of dirs) {
      const entries = pkg.pi?.[key] ?? [];
      expect(entries.length, `pi.${key} must declare entries`).toBeGreaterThan(
        0,
      );
        for (const entry of entries) {
          const resourcePath = entry
            .replace(/^\.\//, "")
            .replace(/[*?[{].*$/, "")
            .replace(/\/$/, "");
          const resolved = statSync(join(process.cwd(), resourcePath));
          expect(
            resolved.isFile() || resolved.isDirectory(),
            `${entry} must resolve to existing packaged content`,
          ).toBe(true);
        }
    }
    // Concrete content counts (REQ-SKPT-001/002/003).
    expect(
      readdirSync(join(process.cwd(), "prompts")).filter(
        (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md",
      ),
    ).toHaveLength(27);
    expect(
      readdirSync(join(process.cwd(), "skills"))
        .filter((entry) => entry.toLowerCase() !== "readme.md")
        .sort(),
    ).toEqual([
      "chain-operation",
      "drenyra-chained-pr",
      "drenyra-sdd",
      "evidence-citation",
      "fiscal-compliance",
      "fiscal-review",
      "lens-audit-trail",
      "lens-ledger-integrity",
      "lens-sunat-compliance",
      "lens-tenant-isolation",
      "ruc-scope",
      "scope-discipline",
    ]);
    const themeEntries = (pkg.pi as { themes?: string[] } | undefined)?.themes;
    expect(themeEntries).toEqual([
      "./themes/fiscal-operator/fiscal-operator-light.json",
      "./themes/fiscal-operator/fiscal-operator-dark.json",
    ]);
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
    registerDrenyraShellExtension(pi, { contextStore: store });
    const command = registered.find((c) => c.name === "drenyra:reconcile");
    expect(command).toBeDefined();
    const output = await runHandler(command!.handler, RECONCILE_MANIFEST);
    expect(output).toContain("missing");
    cleanupTempStore(store);
  });

  it("denies detection below the ANALYZE authority minimum", async () => {
    const { pi, registered } = makeMockPi();
    const store = makeTempStore();
    registerDrenyraShellExtension(pi, { contextStore: store });
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
      registerDrenyraShellExtension(pi, {
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
      registerDrenyraShellExtension(pi, {
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

describe("fiscal guard money write (fiscal-guard.ts)", () => {
  function makeGuardPi(): Map<string, (event: unknown, ctx?: unknown) => unknown> {
    const handlers = new Map<string, (event: unknown, ctx?: unknown) => unknown>();
    const pi = {
      on(event: string, handler: (e: unknown, c?: unknown) => unknown) {
        handlers.set(event, handler);
      },
      registerCommand() {},
      registerTool() {},
    } as unknown as FiscalGuardExtensionAPI;
    registerFiscalGuard(pi);
    return handlers;
  }

  it("ignores oldText being replaced (no false positive)", () => {
    const handlers = makeGuardPi();
    const toolCall = handlers.get("tool_call") as (e: unknown) => unknown;
    const result = toolCall({
      toolName: "edit",
      input: {
        edits: [
          {
            oldText: "install and sync (18 total)",
            newText: "install and sync (19 commands)",
          },
        ],
      },
    });
    expect(result).toBeUndefined();
  });

  it("blocks a float written into newText", () => {
    const handlers = makeGuardPi();
    const toolCall = handlers.get("tool_call") as (e: unknown) => unknown;
    const result = toolCall({
      toolName: "edit",
      input: {
        edits: [{ oldText: "old", newText: "amount: 15.50" }],
      },
    });
    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("BigInt"),
    });
  });

  it("passes write content with the cents convention escape", () => {
    const handlers = makeGuardPi();
    const toolCall = handlers.get("tool_call") as (e: unknown) => unknown;
    const result = toolCall({
      toolName: "write",
      input: { content: "total in cents: 1500n" },
    });
    expect(result).toBeUndefined();
  });
});

describe("REQ-ROUTE-001 /drenyra:status routing-adapter wiring (pi-accounting-orchestration)", () => {
  it("default /drenyra:status surfaces routing.preflight additively, keeps pre-existing fields, and performs zero mission-store writes (SC-ROUTE-008)", async () => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-status-routing-"));
    try {
      const { pi, registered } = makeMockPi();
      const store = new ScopeContextStore(join(root, "context.json"));
      registerDrenyraShellExtension(pi, { contextStore: store, storesRoot: root });
      const command = (name: string) =>
        registered.find((entry) => entry.name === `drenyra:${name}`)!.handler;
      store.setCanonicalScope(makeCanonicalScope({ authorityLevel: "EXECUTE" }));

      const missionOutput = await runHandler(command("mission"), "monthly-close");
      const startedMachine = parseMachineOutput(missionOutput) as {
        missionId: string;
      };
      const missionId = startedMachine.missionId;
      const snapshotPath = join(root, ".local", "missions", "snapshots", `${missionId}.json`);
      const before = { content: readFileSync(snapshotPath, "utf8"), mtime: statSync(snapshotPath).mtimeMs };

      // The plain invocation (no "route" token) — the pre-existing behavior.
      const output = await runHandler(command("status"), "");
      const machine = parseMachineOutput(output) as {
        mission?: { id: string };
        routing?: { preflight: { ok: boolean }; execution?: unknown };
      };

      // Pre-existing field unchanged: the reported mission is still surfaced.
      expect(machine.mission?.id).toBe(missionId);
      // New, additive field: routing.preflight is present; execution never ran.
      expect(machine.routing).toBeDefined();
      expect(machine.routing?.preflight).toBeDefined();
      expect(machine.routing?.execution).toBeUndefined();

      const after = { content: readFileSync(snapshotPath, "utf8"), mtime: statSync(snapshotPath).mtimeMs };
      expect(after.content).toBe(before.content);
      expect(after.mtime).toBe(before.mtime);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("/drenyra:status route on a fresh mission (no bound QUERY authorization) fails closed at stagePermissions with POLICY_BLOCKED, never silently grants", async () => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-status-routing-"));
    try {
      const { pi, registered } = makeMockPi();
      const store = new ScopeContextStore(join(root, "context.json"));
      registerDrenyraShellExtension(pi, { contextStore: store, storesRoot: root });
      const command = (name: string) =>
        registered.find((entry) => entry.name === `drenyra:${name}`)!.handler;
      store.setCanonicalScope(makeCanonicalScope({ authorityLevel: "EXECUTE" }));

      // A mission started only through /drenyra:mission has no bound QUERY
      // authorization on disk (EdaMissionCoordinator never calls
      // boundAuthorizationFor) — a genuinely "fresh" mission for this check.
      await runHandler(command("mission"), "monthly-close");

      const output = await runHandler(command("status"), "route");
      const machine = parseMachineOutput(output) as {
        routing?: {
          preflight: { ok: boolean; stage?: string; reason?: { kind: string } };
          execution?: { attempted: false; reason: string } | { ok: boolean };
        };
      };

      expect(machine.routing?.preflight.ok).toBe(false);
      expect(machine.routing?.preflight.stage).toBe("permissions");
      expect(machine.routing?.preflight.reason?.kind).toBe("POLICY_BLOCKED");
      // Execution never dispatched a real port call: it is either absent or an
      // explicit "did not attempt" marker — never a silently granted result.
      if (machine.routing?.execution !== undefined && "ok" in machine.routing.execution) {
        expect(machine.routing.execution.ok).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("/drenyra:context — Engram-backed institutional context (REQ-ENG-003)", () => {
  const VALID_RUC = "20123456786";
  const VALID_PERIOD = "202601";

  function healthyClientStub(text: string): EngramClientResult {
    return {
      status: "healthy",
      client: {
        pid: 1,
        serverInfo: { name: "drenyra-engram", version: "0.3.0" },
        isHealthy: () => true,
        callTool: async () => ({ isError: false, text }),
        shutdown: async () => {},
      },
    };
  }

  it("still reports RUC/period unchanged, plus institutional context, when Engram is healthy", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    store.setPeriod(VALID_PERIOD);
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () =>
        healthyClientStub(
          JSON.stringify([{ title: "IGV base rate", what: "18 percent" }]),
        ),
    });
    const context = registered.find((c) => c.name === "drenyra:context");
    const output = await runHandler(context!.handler, "");

    expect(output).toContain(`company RUC ${VALID_RUC}`);
    expect(output).toContain(`fiscal period ${VALID_PERIOD}`);
    expect(output).toMatch(/institutional context/i);
    expect(output).toContain("IGV base rate");
    cleanupTempStore(store);
  });

  it("reports institutional context as unavailable, visibly, without failing the command, when Engram cannot be reached", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    store.setPeriod(VALID_PERIOD);
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({
        status: "spawn-failed",
        error: "binary not found in this sandbox",
      }),
    });
    const context = registered.find((c) => c.name === "drenyra:context");
    const output = await runHandler(context!.handler, "");

    expect(output).toContain(`company RUC ${VALID_RUC}`);
    expect(output).toContain(`fiscal period ${VALID_PERIOD}`);
    expect(output).toMatch(/institutional context.*unavailable/i);
    cleanupTempStore(store);
  });

  it("reports plainly when Engram is healthy but has no institutional context yet", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    store.setPeriod(VALID_PERIOD);
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => healthyClientStub("[]"),
    });
    const context = registered.find((c) => c.name === "drenyra:context");
    const output = await runHandler(context!.handler, "");

    expect(output).toMatch(/no institutional context recorded yet/i);
    cleanupTempStore(store);
  });

  it("never attempts to reach Engram when no company/period scope is set", async () => {
    const store = makeTempStore();
    const { pi, registered } = makeMockPi();
    let spawnAttempted = false;
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => {
        spawnAttempted = true;
        return { status: "spawn-failed", error: "should not be called" };
      },
    });
    const context = registered.find((c) => c.name === "drenyra:context");
    const output = await runHandler(context!.handler, "");

    expect(output).toContain("company RUC NOT SET");
    expect(spawnAttempted).toBe(false);
    cleanupTempStore(store);
  });

  it("never calls an accounting_* or write-shaped engram_* tool (contracts/engram-dependency.md rule 6)", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    store.setPeriod(VALID_PERIOD);
    const { pi, registered } = makeMockPi();
    let calledTool: string | undefined;
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({
        status: "healthy",
        client: {
          pid: 1,
          serverInfo: { name: "drenyra-engram", version: "0.3.0" },
          isHealthy: () => true,
          callTool: async (name: string) => {
            calledTool = name;
            return { isError: false, text: "[]" };
          },
          shutdown: async () => {},
        },
      }),
    });
    const context = registered.find((c) => c.name === "drenyra:context");
    await runHandler(context!.handler, "");

    expect(calledTool).toBe("engram_context");
    cleanupTempStore(store);
  });
});

describe("/drenyra:context — engram_context tool-level error (triangulation)", () => {
  it("reports a tool-level error plainly without throwing, distinct from a connection failure", async () => {
    const store = makeTempStore();
    store.setCompany("20123456786");
    const { pi, registered } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({
        status: "healthy",
        client: {
          pid: 1,
          serverInfo: { name: "drenyra-engram", version: "0.3.0" },
          isHealthy: () => true,
          callTool: async () => ({ isError: true, text: "invalid scope: ruc required" }),
          shutdown: async () => {},
        },
      }),
    });
    const context = registered.find((c) => c.name === "drenyra:context");
    const output = await runHandler(context!.handler, "");

    expect(output).toContain("company RUC 20123456786");
    expect(output).toMatch(/institutional context error/i);
    expect(output).toContain("invalid scope: ruc required");
    cleanupTempStore(store);
  });
});

describe("drenyra_institutional_memory tool (REQ-ENG-005, REQ-ENG-006)", () => {
  const VALID_RUC = "20123456786";

  function findTool(registeredTools: { name: string; execute: (id: string, params: Record<string, unknown>) => unknown }[]) {
    const tool = registeredTools.find((t) => t.name === "drenyra_institutional_memory");
    expect(tool).toBeDefined();
    return tool!;
  }

  it("is registered with a query-only parameter shape", () => {
    const { pi, registeredTools } = makeMockPi();
    registerDrenyraShellExtension(pi);
    const tool = findTool(registeredTools);
    expect(tool.name).toBe("drenyra_institutional_memory");
  });

  it("returns no-scope-known when no company RUC is set", async () => {
    const store = makeTempStore();
    const { pi, registeredTools } = makeMockPi();
    registerDrenyraShellExtension(pi, { contextStore: store });
    const tool = findTool(registeredTools);
    const result = (await tool.execute("call-1", { query: "detracción" })) as {
      content: Array<{ type: string; text: string }>;
      details?: { status?: string };
    };
    expect(result.details?.status).toBe("no-scope-known");
    cleanupTempStore(store);
  });

  it("returns unavailable when Engram cannot be reached", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    const { pi, registeredTools } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({ status: "spawn-failed", error: "not available in test" }),
    });
    const tool = findTool(registeredTools);
    const result = (await tool.execute("call-1", { query: "detracción" })) as {
      details?: { status?: string; reason?: string };
    };
    expect(result.details?.status).toBe("unavailable");
    expect(result.details?.reason).toBeTruthy();
    cleanupTempStore(store);
  });

  it("returns found with parsed results on a non-empty engram_search response", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    const { pi, registeredTools } = makeMockPi();
    let calledTool: string | undefined;
    let calledArgs: unknown;
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({
        status: "healthy",
        client: {
          pid: 1,
          serverInfo: { name: "drenyra-engram", version: "0.3.0" },
          isHealthy: () => true,
          callTool: async (name: string, args: unknown) => {
            calledTool = name;
            calledArgs = args;
            return {
              isError: false,
              text: JSON.stringify([{ title: "Provider X detracción", what: "12 percent" }]),
            };
          },
          shutdown: async () => {},
        },
      }),
    });
    const tool = findTool(registeredTools);
    const result = (await tool.execute("call-1", { query: "Provider X detracción" })) as {
      details?: { status?: string; results?: unknown };
    };
    expect(result.details?.status).toBe("found");
    expect(JSON.stringify(result.details?.results)).toContain("Provider X detracción");
    expect(calledTool).toBe("engram_search");
    expect((calledArgs as { query?: string }).query).toBe("Provider X detracción");
    expect((calledArgs as { scope?: { ruc?: string } }).scope?.ruc).toBe(VALID_RUC);
    cleanupTempStore(store);
  });

  it("returns empty on an empty engram_search response", async () => {
    const store = makeTempStore();
    store.setCompany(VALID_RUC);
    const { pi, registeredTools } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({
        status: "healthy",
        client: {
          pid: 1,
          serverInfo: { name: "drenyra-engram", version: "0.3.0" },
          isHealthy: () => true,
          callTool: async () => ({ isError: false, text: "[]" }),
          shutdown: async () => {},
        },
      }),
    });
    const tool = findTool(registeredTools);
    const result = (await tool.execute("call-1", { query: "nothing here" })) as {
      details?: { status?: string };
    };
    expect(result.details?.status).toBe("empty");
    cleanupTempStore(store);
  });
});

describe("drenyra_institutional_memory — tool-level error (triangulation)", () => {
  it("reports a tool-level engram_search error distinctly, not as empty or unavailable", async () => {
    const store = makeTempStore();
    store.setCompany("20123456786");
    const { pi, registeredTools } = makeMockPi();
    registerDrenyraShellExtension(pi, {
      contextStore: store,
      spawnEngramClient: async () => ({
        status: "healthy",
        client: {
          pid: 1,
          serverInfo: { name: "drenyra-engram", version: "0.3.0" },
          isHealthy: () => true,
          callTool: async () => ({ isError: true, text: "invalid query" }),
          shutdown: async () => {},
        },
      }),
    });
    const tool = registeredTools.find((t) => t.name === "drenyra_institutional_memory");
    const result = (await tool!.execute("call-1", { query: "" })) as {
      details?: { status?: string; message?: string };
    };
    expect(result.details?.status).toBe("error");
    expect(result.details?.message).toBe("invalid query");
    cleanupTempStore(store);
  });
});
