// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are whatever the spawned
// server reports (not this module's concern to police); exit/status codes
// are JSON integers — never floats. This module contains no money logic; it
// supervises the drenyra-engram MCP child process.
/**
 * MCP child-process lifecycle for the pinned drenyra-engram binary.
 *
 * Contract: contracts/engram-dependency.md, design.md §6.
 *   - Never spawns an unverified binary — verifyEngramPin must report
 *     "verified" first (engram-pin.ts).
 *   - Plain `initialize` handshake, no DRENYRA_DEFAULT_SCOPE injection: Pi
 *     is the party that knows scope, not the party receiving it (design §6
 *     rejected env-var injection for that reason).
 *   - Read-only consumption only: this module itself calls no tool; callers
 *     (e.g. the /drenyra:context handler, Slice C) decide which tool to
 *     call, and contracts/engram-dependency.md rule 6 restricts that to
 *     engram_context and no write-shaped tool.
 */

import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type EngramPinReport, verifyEngramPin } from "./engram-pin.js";

export interface SpawnEngramClientInput {
  /** Directory the platform-named tarballs live in (vendored/drenyra-engram in production). */
  vendoredRoot: string;
  platform: string;
  arch: string;
  /** SQLite database path passed to `drenyra-engram mcp --db <path>`. */
  dbPath: string;
  /** Bound on the initialize handshake; default 5000ms. */
  handshakeTimeoutMs?: number;
}

export interface ToolCallOutcome {
  isError: boolean;
  text: string;
}

export interface EngramClient {
  readonly pid: number;
  readonly serverInfo: { name: string; version: string };
  /** False once the child process has exited or errored, or after shutdown(). */
  isHealthy(): boolean;
  /** Calls one MCP tool by name; rejects if the client is not healthy. */
  callTool(name: string, args: unknown): Promise<ToolCallOutcome>;
  /** Graceful shutdown: SIGTERM, bounded wait, SIGKILL if still alive. Idempotent. */
  shutdown(): Promise<void>;
}

export type EngramClientResult =
  | { status: "verification-failed"; report: EngramPinReport }
  | { status: "spawn-failed"; error: string }
  | { status: "handshake-timeout" }
  | { status: "healthy"; client: EngramClient };

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 5000;
const SHUTDOWN_GRACE_MS = 2000;

/**
 * Extract the verified vendored tarball into a fresh temp directory and
 * return the path to the executable inside it. Extraction happens once per
 * spawn (no cross-call cache in this slice — a disclosed, deliberate scope
 * cut, not an oversight: correctness first, caching is a later concern).
 */
function extractBinary(tarballPath: string): string {
  const destDir = mkdtempSync(join(tmpdir(), "pi-engram-bin-"));
  const result = spawnSync("tar", ["-xzf", tarballPath, "-C", destDir], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `failed to extract vendored drenyra-engram artifact: ${result.stderr?.toString() ?? "unknown tar error"}`,
    );
  }
  const binaryPath = join(destDir, "drenyra-engram");
  chmodSync(binaryPath, 0o755);
  return binaryPath;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

class StdioJsonRpcClient implements EngramClient {
  readonly pid: number;
  readonly serverInfo: { name: string; version: string };

  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, PendingCall>();
  private nextId = 1;
  private buffer = "";
  private healthy = true;

  constructor(
    child: ChildProcessWithoutNullStreams,
    serverInfo: { name: string; version: string },
  ) {
    this.child = child;
    this.pid = child.pid ?? -1;
    this.serverInfo = serverInfo;

    child.stdout.on("data", (chunk: Buffer) => this.onStdout(chunk));
    child.once("exit", () => this.onChildGone());
    child.once("error", () => this.onChildGone());
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  private onChildGone(): void {
    this.healthy = false;
    for (const { reject } of this.pending.values()) {
      reject(new Error("drenyra-engram child process exited or errored"));
    }
    this.pending.clear();
  }

  private onStdout(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      newlineIndex = this.buffer.indexOf("\n");
      if (line.trim().length === 0) continue;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    let message: { id?: number; result?: unknown; error?: { message: string } };
    try {
      message = JSON.parse(line);
    } catch {
      return; // Not a JSON-RPC line (e.g. stray log output); ignore rather than crash.
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message));
    } else {
      pending.resolve(message.result);
    }
  }

  private request(method: string, params: unknown, timeoutMs?: number): Promise<unknown> {
    if (!this.healthy) {
      return Promise.reject(new Error("drenyra-engram client is not healthy"));
    }
    const id = this.nextId++;
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const wrappedResolve = (value: unknown) => {
        if (timer) clearTimeout(timer);
        resolve(value);
      };
      const wrappedReject = (error: Error) => {
        if (timer) clearTimeout(timer);
        reject(error);
      };
      this.pending.set(id, { resolve: wrappedResolve, reject: wrappedReject });
      if (timeoutMs) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`request "${method}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.child.stdin.write(payload, (err) => {
        if (err) {
          this.pending.delete(id);
          wrappedReject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
  }

  async callTool(name: string, args: unknown): Promise<ToolCallOutcome> {
    const result = (await this.request("tools/call", { name, arguments: args })) as {
      content?: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    const text = result.content?.[0]?.text ?? "";
    return { isError: result.isError ?? false, text };
  }

  shutdown(): Promise<void> {
    if (!this.healthy && this.child.exitCode !== null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const onExit = () => {
        this.healthy = false;
        resolve();
      };
      this.child.once("exit", onExit);
      this.child.kill("SIGTERM");
      setTimeout(() => {
        if (this.child.exitCode === null) {
          this.child.kill("SIGKILL");
        }
      }, SHUTDOWN_GRACE_MS);
    });
  }
}

/**
 * Verify the pinned binary, extract it, spawn `drenyra-engram mcp --db
 * <dbPath>`, and perform the MCP `initialize` handshake within a bounded
 * timeout. Never proceeds past an unverified pin — a failed verification
 * never results in a spawn attempt.
 */
export async function spawnEngramClient({
  vendoredRoot,
  platform,
  arch,
  dbPath,
  handshakeTimeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS,
}: SpawnEngramClientInput): Promise<EngramClientResult> {
  const report = await verifyEngramPin({ vendoredRoot, platform, arch });
  if (report.verdict !== "verified" || !report.resolvedPath) {
    return { status: "verification-failed", report };
  }

  let binaryPath: string;
  try {
    binaryPath = extractBinary(report.resolvedPath);
  } catch (error) {
    return {
      status: "spawn-failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(binaryPath, ["mcp", "--db", dbPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    return {
      status: "spawn-failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const spawnError = await new Promise<string | undefined>((resolve) => {
    const onError = (err: Error) => resolve(err.message);
    const onSpawn = () => {
      child.off("error", onError);
      resolve(undefined);
    };
    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
  if (spawnError) {
    return { status: "spawn-failed", error: spawnError };
  }

  const initializeResult = await new Promise<
    { serverInfo?: { name: string; version: string } } | "timeout"
  >((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve("timeout");
    }, handshakeTimeoutMs);

    let buffer = "";
    const onData = (chunk: Buffer) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1 && !settled) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
        if (line.trim().length === 0) continue;
        try {
          const message = JSON.parse(line);
          if (message.id === 1 && message.result) {
            settled = true;
            clearTimeout(timer);
            child.stdout.off("data", onData);
            resolve(message.result);
          }
        } catch {
          // Not JSON (stray log output on stdout); ignore and keep waiting.
        }
      }
    };
    child.stdout.on("data", onData);
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "drenyra-shell", version: "0.1.0" },
        },
      })}\n`,
    );
  });

  if (initializeResult === "timeout") {
    child.kill("SIGKILL");
    return { status: "handshake-timeout" };
  }
  if (!initializeResult.serverInfo) {
    child.kill("SIGKILL");
    return { status: "spawn-failed", error: "initialize handshake returned no serverInfo" };
  }

  return {
    status: "healthy",
    client: new StdioJsonRpcClient(child, initializeResult.serverInfo),
  };
}
