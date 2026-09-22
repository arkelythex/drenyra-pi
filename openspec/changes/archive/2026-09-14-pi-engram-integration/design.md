# Design — pi-engram-integration

**Change:** `pi-engram-integration`
**Phase:** design — resolves the 4 open questions `proposal.md` §4 left for this phase. No product/scope decision (D1–D3) is reopened.
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Authority:** `proposal.md` (scope), `preproposal.md` (D1–D3), `specs/engram-integration/spec.md` (REQ-ENG-001..004)

---

## §1 — Vendoring shape for the per-platform binary (proposal §4.1)

**Decision:** Vendor four platform builds — `linux_amd64`, `linux_arm64`, `darwin_amd64`, `darwin_arm64` — as separate checksummed tarballs under `vendored/drenyra-engram/`, selected at runtime by `process.platform` + `process.arch`. **Windows is explicitly not vendored in this slice** — `runtime/doctor.ts`-equivalent verification reports a clear, honest "unsupported platform" diagnostic rather than silently failing or pretending support.

**Why these four, not all six the sibling repo builds:** the sibling repository's `dist/` already produces `linux_amd64`, `linux_arm64`, `darwin_amd64`, `darwin_arm64`, plus `windows_amd64`/`windows_arm64`. This development environment and the accounting-operator tooling ecosystem this harness targets are Linux/macOS-first (every existing `runtime/doctor.ts`/`verify-packed-install.mjs` check in this repo already assumes a POSIX shell — `sh -c`, `node -e`, no `.exe`/`.bat` handling anywhere). Adding Windows now would mean designing and testing a platform-detection and verification path this repository has never needed before, for a platform with no existing consumer evidence. Deferred, not silently dropped — recorded as an explicit limitation in `capability-manifest.yaml`, matching `REQ-ENG-004`'s honesty requirement.

**Why per-platform tarballs, not a single "fat" artifact:** the binary is compiled Go, not portable JS like `drenyra-ai`'s vendored tarball — there is no portable single-file form to vendor. Four small, individually checksummed artifacts (one selected at a time) keep the fail-closed verification story identical in shape to the existing `drenyra-ai` pin (`runtime/doctor.ts`: read pin → verify checksum → refuse if it doesn't match), just parameterized by platform.

**Checksum record:** a new `contracts/engram-dependency.md` §"Pinned artifacts" table (one row per platform, sha256 + exact upstream build identifier `drenyra-engram_0.2.1-SNAPSHOT-6a371a9_<platform>`), plus entries in `contracts/SHA256SUMS.json` alongside the existing frozen-contract checksums — reusing the exact verification mechanism `scripts/verify-capability-manifest.mjs`/`verify-package-files.mjs` already apply to other frozen bytes, not inventing a second checksum system.

---

## §2 — Scope-read failure policy (proposal §4.2)

**Superseded by §6's resolution below — kept here for the record, not applied.** This section originally assumed Engram would be the source of truth for the active scope pointer, and designed a failure policy for that case (reuse `scope-guard.ts`'s existing `pre-scope`/`requires-scope` fail-closed handling; no local fallback cache). Direct testing against the live MCP server (§6) showed Engram's schema has no session-pointer concept, so the local pointer in `runtime/context.ts` was kept instead (maintainer decision, §6). Consequently:

- `extensions/scope-guard.ts`'s `pre-scope`/`requires-scope` policy is **completely unaffected by this change** — it already worked, and nothing about it changes. Scope-requiring commands never depended on Engram and still don't.
- "Engram unreachable" now only affects `/drenyra:context`'s optional institutional-context addendum (`REQ-ENG-003`): the command still reports RUC/period exactly as it does today (that part never touched Engram), and simply omits or flags-as-unavailable the institutional-context portion, visibly (never silently), when the child process cannot be reached. This is a strictly smaller, lower-risk failure surface than originally designed — no command that previously succeeded can now fail closed because of Engram.
- `REQ-ENG-002` scenario 2's "does not crash the command and does not silently invent or discard scope" language still holds, more simply: there is no scope to invent or discard here, because Engram never held it.

**Consequence for tasks:** no scope-guard changes at all. The only new "is Engram reachable" branching lives inside `/drenyra:context`'s handler.

---

## §3 — Contract file location (proposal §4.3)

**Decision:** New sibling file `contracts/engram-dependency.md`, added to `contracts/README.md`'s contract index table as a new row (`0.1`, status `frozen` once this change archives, boundary: "Pinned, verified, package-local `drenyra-engram` binary and its MCP consumption surface").

**Why not extend `runtime-dependency.md`:** that file's own title, scope, and every rule in it (`Rules` §1–3: "pinned exact version," "package-local install," "install source... vendored tarball") describe a single npm-package-shaped dependency pattern. This change's dependency has a materially different shape — a per-platform compiled binary spawned as a child process, not an npm-imported library. Folding both into one file would make `runtime-dependency.md` either misleading (rules that don't apply to the binary) or bloated with conditional branches per dependency. A second, parallel contract file — mirroring the same discipline (`Version`, `Status`, `Rules`, `Verification`) `runtime-dependency.md` already established — keeps each contract legible on its own, and matches this repository's existing pattern of one contract file per governed boundary (`contracts/evidence/`, `contracts/authority/`, `contracts/receipts/`, `contracts/mission/` are already separate families, not merged).

---

## §4 — MCP binding point (proposal §4.4)

**Decision:** Plain `initialize` handshake (no `DRENYRA_DEFAULT_SCOPE` env var injected at spawn time), followed by explicit tool calls for scope read/write.

**Why not `DRENYRA_DEFAULT_SCOPE`:** per `docs/CONSUMING.md` in the sibling repository, that variable's stated purpose is letting an agent *arrive already knowing* its scope, injected by whatever orchestrates the agent session. In this integration, Shell is the party that **sets** scope (via `/drenyra:company`, `/drenyra:period`, `/drenyra:scope`) and Engram is the persistence target — the data flow is the reverse of what that variable is for. Using it here would mean Shell has to already know the scope before asking Engram for it, which defeats the purpose of persisting scope in Engram at all.

**Exact tool names:** left to the tasks/apply phase — this design phase confirms the binding *shape* (explicit tool calls after a plain handshake, not env-var injection), not the literal tool identifiers, which should be read directly from the running `drenyra-engram mcp` server's tool list at implementation time rather than guessed here (the sibling repo's docs enumerate 13 general `engram_*` + 44 `accounting_*` tools by count, not by a name a design phase should hand-copy without verifying against the live server).

---

## §5 — Summary table

| Open question | Resolved as |
| --- | --- |
| Vendoring shape | 4 platform tarballs (linux/darwin × amd64/arm64), Windows explicitly deferred and disclosed |
| Scope-read failure policy | Reuse existing `scope-guard.ts` pre-scope/requires-scope fail-closed handling; no fallback cache |
| Contract file | New `contracts/engram-dependency.md`, own row in `contracts/README.md` |
| MCP binding point | Plain `initialize` + explicit tool calls; tool names confirmed against the live server at apply time |

No requirement in `specs/engram-integration/spec.md` needed correction by this design pass.

---

## §6 — BLOCKING discovery made while starting `tasks.md`: Engram's scope model has no session-pointer concept

Before writing `tasks.md`, the live `drenyra-engram mcp` binary was spawned locally and its real MCP `tools/list` + tool input schemas were read directly (not assumed from docs). This surfaced a genuine feasibility gap in D3's confirmed "minimal: scope only" plan.

**What was measured:**

- 13 `engram_*` tools exist: `engram_save`, `engram_get`, `engram_get_by_topic`, `engram_chain`, `engram_search`, `engram_context`, `engram_compare`, `engram_doctor`, `engram_reject`, `engram_void`, `engram_supersede`, `engram_relations`, `engram_transitions`.
- Every one of them that takes a `scope` object constrains it to `scope.kind: "company" | "institutional"` — there is no third, generic/session/app-state scope kind.
- `kind: "company"` **requires** `ruc` (11 digits), `organizationId`, `companyId`.
- `kind: "institutional"` requires none of those — but its documented meaning is "explicit cross-company knowledge" (e.g., a regulatory fact true across every company), not application/session state.

**Why this breaks D3 as confirmed:** the plan was to persist Shell's active company/period *pointer* in Engram so a new session can recover "what RUC/period was I last in" without already knowing it. But:

- Storing that pointer under `kind: "company"` is circular — reading it back requires already supplying the `ruc` you are trying to discover.
- Storing it under `kind: "institutional"` technically has no schema objection, but is a semantic misuse of a scope kind meant for genuine cross-company accounting facts, not Shell's own UI/session state — this would violate `REQ-ENG-004`'s honesty spirit even if no guard test catches it mechanically, and risks colliding with real institutional-knowledge topic keys a future accounting feature might use.

**This was not visible from documentation alone** (`docs/CONSUMING.md` and the CLI `--help` text do not show the `scope.kind` enum) — only the live MCP `tools/list` schema revealed it. Design §2's "reuse the existing fail-closed scope-guard, no local cache" decision is still correct as far as it goes, but it assumed a home for the *positive* case (a reachable Engram *does* return the current scope) that the schema does not actually provide.

**This is now a blocking product decision, not a design-phase call** — it changes what "minimal" can mean. Options surfaced for the maintainer (not decided here):

1. **Narrower minimal slice than D3 intended:** keep the current-scope *pointer* local (i.e., `runtime/context.ts` keeps a minimal local file — just the pointer, not the full dev-grade store it is today), and use Engram only for what its schema actually supports once scope is already known: `engram_context`/`accounting_current_context` reads for that already-known company. This is a smaller, honest slice, but it is not "replace the local file," which is what D3 was understood to mean.
2. **Use `institutional` scope as a deliberate, documented exception**, with an explicit reserved `topicKey` (e.g. `pi/session/active-scope`) and a clear comment/contract note that this is Shell's own session pointer, not genuine institutional accounting knowledge — accepting the semantic stretch as a pragmatic, disclosed choice.
3. **Escalate to `drenyra-engram` maintainers** (a request, not a workaround): ask whether a session/app-state scope kind is planned or acceptable to add, and pause this slice until that's answered.
4. **Redefine this slice's scope entirely**, moving straight to the "fuller" depth D3 declined (proposal-informing reads only, once scope is already known some other way) — accepting that "just persist scope in Engram" was never a good fit for this engine's domain model.

No option above is selected. `tasks.md` is not written until the maintainer picks one.

### Resolution (maintainer, 2026-09-14): Option 1 — narrower slice, pointer stays local

`runtime/context.ts` **keeps its local file** (`~/.drenyra/context.json`) as the sole source of truth for "what is Shell's currently active company/period" — this is not a fit Engram's schema provides, and forcing it (option 2) or abandoning D3's bounded depth (option 4) were both rejected. Engram integration in this slice is narrowed to exactly what `engram_context`/`accounting_current_context` actually do: **once the local pointer already supplies a known, valid RUC + period**, Shell may read institutional context for that scope from Engram.

**This changes `spec.md#REQ-ENG-003` and `proposal.md`'s scope section**, both updated in this same pass (not silently — see the correction notes in each file). `REQ-ENG-001` (pinned binary), `REQ-ENG-002` (fail-closed child-process lifecycle), and `REQ-ENG-004` (honest capability state) are unaffected — the dependency, its lifecycle, and the honesty requirement are identical regardless of which Engram call is made once connected.

**What this slice now concretely delivers:** the vendored, pinned `drenyra-engram` binary; its fail-closed MCP child-process lifecycle; and a single new read path — given the local pointer's current RUC + period, call `engram_context` (general, not `accounting_current_context`, since this slice makes no fiscal-effect claim) and surface whatever institutional context comes back through `/drenyra:context` (the existing command already scoped for this per `docs/architecture.md`'s command list) — never through a command that mutates or proposes anything. No new local persistence code is needed for the pointer (it already exists); this slice's new code is the binary/lifecycle plumbing plus one read call.
