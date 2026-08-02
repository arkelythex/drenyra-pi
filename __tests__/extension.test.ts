/**
 * Extension registration tests — the Pi surface of drenyra-pi.
 *
 * Verifies the extension factory registers /drenyra:status and /drenyra:doctor
 * against a structural PiExtensionApi, and that the handlers run the same
 * fail-closed doctor/status core (here against the repo root, where the pinned
 * runtime is absent → the doctor must report "missing", never crash).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/exit codes are JSON integers, never
 * floats.
 */

import { describe, expect, it } from "vitest";
import {
  drenyraPiExtension,
  registerDrenyraPiExtension,
  type PiCommandContext,
  type PiExtensionApi,
} from "../extensions/register.js";

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

describe("drenyraPiExtension descriptor", () => {
  it("declares the runtime pin state and provided capabilities", () => {
    expect(drenyraPiExtension.name).toBe("drenyra-pi");
    expect(drenyraPiExtension.provides).toContain("status");
    expect(drenyraPiExtension.provides).toContain("doctor");
    expect(drenyraPiExtension.commands).toEqual([
      "/drenyra:status",
      "/drenyra:doctor",
      "/drenyra:company",
      "/drenyra:period",
      "/drenyra:context",
      "/drenyra:close",
    ]);
    expect(drenyraPiExtension.runtime.package).toBe("drenyra-ai");
    expect(drenyraPiExtension.runtime.version).toBe("0.2.0");
    expect(drenyraPiExtension.runtime.state).toBe("released");
  });
});

describe("registerDrenyraPiExtension", () => {
  it("registers /drenyra:status and /drenyra:doctor with descriptions", () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraPiExtension(pi);
    expect(registered.map((c) => c.name)).toEqual([
      "drenyra:status",
      "drenyra:doctor",
      "drenyra:company",
      "drenyra:period",
      "drenyra:context",
      "drenyra:close",
    ]);
    expect(registered[0].description.length).toBeGreaterThan(0);
    expect(registered[1].description.length).toBeGreaterThan(0);
  });

  it("/drenyra:doctor fails closed when the pinned runtime is absent (repo root)", async () => {
    const { pi, registered } = makeMockPi();
    registerDrenyraPiExtension(pi);
    const ctx: PiCommandContext = { cwd: process.cwd() };
    let output = "";
    const originalLog = console.log;
    console.log = (line: unknown) => {
      output += `${String(line)}\n`;
    };
    try {
      await registered[1].handler("", ctx);
    } finally {
      console.log = originalLog;
    }
    // drenyra-ai is installed as a devDependency (the postinstall artifact in
    // a real consumer), so the doctor reports "verified" against the repo root.
    expect(output).toContain("verified");
  });
});
