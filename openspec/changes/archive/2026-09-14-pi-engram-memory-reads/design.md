# Design — pi-engram-memory-reads

**Change:** `pi-engram-memory-reads`
**Phase:** design — resolves implementation shape for `proposal.md`'s bounded scope. No product decision (D1–D3) is reopened; §1 below is the one shape correction the proposal already disclosed.
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Authority:** `proposal.md` (scope, including its §2 correction), `preproposal.md` (D1–D3), `specs/engram-integration/spec.md` delta (`REQ-ENG-005`, `REQ-ENG-006`)

---

## §1 — Tool name and shape

**Name:** `drenyra_institutional_memory`. Not `engram_search` or `mem_search` — both names are already meaningful to `journal-candidate-agent` (the latter is its existing generic dev-memory tool; reusing either name for a different, RUC-scoped, institutional-accounting tool would be actively confusing to the agent's own reasoning about which tool does what).

**Parameters:** `Type.Object({ query: Type.String({ description: "..." }) })` — the query only. Scope is never agent-supplied (`proposal.md` §3, R1's mitigation).

**Return shape** (mirrors `/drenyra:context`'s existing typed handling in `extensions/register.ts`, `REQ-ENG-005`'s three scenarios):

```ts
type InstitutionalMemoryResult =
  | { status: "no-scope-known" }
  | { status: "unavailable"; reason: string }
  | { status: "found"; results: unknown }   // parsed engram_search JSON text
  | { status: "empty" };                     // engram_search returned []
```

Rendered to the agent as `content: [{ type: "text", text: <human-readable summary> }]` per the real `pi.registerTool()` contract (`@earendil-works/pi-coding-agent` docs, read directly during exploration) — never a bare object, and never an error thrown across the tool boundary (a thrown error inside `execute()` would surface as a tool failure to the agent, not as the graceful "no institutional context" outcome `REQ-ENG-005` scenario 2/3 require).

## §2 — Implementation location

Inline as a local function inside `registerDrenyraPiExtension` in `extensions/register.ts`, alongside `contextHandler` — reusing the exact same `spawnEngramClientFn`, `PACKAGE_ROOT`, `homedir()`, and `contextStore` already in scope there, and the exact same `DrenyraPiExtensionDeps.spawnEngramClient` injection point already proven testable in Slice C. No new module: the tool's logic is small enough (build scope from the local RUC, call `spawnEngramClientFn`, call `engram_search`, map the four-case result) that a new file would be pure ceremony for one ~30-line function.

## §3 — `contracts/engram-dependency.md` rule 6 update

Rule 6 gains one clause: `engram_search` (general, read-only) joins `engram_context` as an allowed call — both are `engram_*` family, neither is `accounting_*`, neither is write-shaped. The rule's existing prohibition list is otherwise unchanged.

## §4 — `agents/journal-candidate-agent.md` frontmatter

```diff
-tools: read, grep, glob, bash, mem_search, mem_get_observation, mem_save
+tools: read, grep, glob, bash, mem_search, mem_get_observation, mem_save, drenyra_institutional_memory
```

The agent's own prompt body gains one short paragraph (not a restructure) telling it the tool exists, when to use it (before drafting a candidate, when a provider/account pattern might be institutionally known), and — explicitly, matching `REQ-ENG-006` — that a result never changes review depth or authority, only which candidate it drafts.

## §5 — No child-process caching (unchanged scope cut, restated for this slice)

Same disclosed cut as `pi-engram-integration`: each call extracts and spawns fresh via the existing `spawnEngramClient`. This slice does not touch `runtime/engram-client.ts` (`proposal.md` §3, explicitly out of scope) — a future slice may add caching across a session if call volume warrants it.

## §6 — Summary table

| Decision | Resolved as |
| --- | --- |
| Tool name | `drenyra_institutional_memory` |
| Parameters | `{ query: string }` only |
| Return shape | 4-case typed result, never a thrown error across the tool boundary |
| Implementation location | Inline in `extensions/register.ts`, alongside `contextHandler` |
| Contract update | `contracts/engram-dependency.md` rule 6 gains `engram_search` |
| Agent frontmatter | `journal-candidate-agent.md` gains the tool name; prompt body gains one short usage paragraph |
