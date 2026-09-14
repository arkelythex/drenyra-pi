```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:4f6a11eeeda72816c40469901c6b88f5d12a4a9b8c2442cdce8051043fb69c8d
verdict: pass
blockers: 0
critical_findings: 0
requirements: 2/2
scenarios: 5/5
test_command: bun test
test_exit_code: 0
test_output_hash: sha256:22a4d31f8d9165a7a54ea8cedbf6f95f778235bfb67ad97f90d528f286133ea9
build_command: bun run build
build_exit_code: 0
build_output_hash: sha256:627d23ef6f9b2d3ee904fad69af3c60a8fac8899a4657fbfd54343ce9cfa4829
```

# Verify Report — pi-engram-memory-reads

**Change:** `pi-engram-memory-reads`
**Phase:** verify
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Branch:** `feat/pi-engram-memory-reads`
**HEAD at verification time:** `c660656` (`feat(engram): drenyra_institutional_memory tool for journal-candidate-agent`)
**Runtime attempt token:** `sha256:2afbcebb4302b202d8cac8cf5f3b89f880de6a429a0af0892b82587793cf0553`
**Native gate:** clean — `gentle-ai sdd-status pi-engram-memory-reads --json` returned `nextRecommended: verify`, `blockedReasons: []`, `taskProgress: 11/11`.

---

## 1. Verdict

**PASS.** 2/2 requirements, 5/5 scenarios, 0 blockers, 0 critical findings, 11/11 tasks complete.

## 2. Task completion

```
$ grep -c '^- \[x\]' openspec/changes/pi-engram-memory-reads/tasks.md
11
$ grep -c '^- \[ \]' openspec/changes/pi-engram-memory-reads/tasks.md
0
```

## 3. Fresh verification evidence

```
$ bun test
799 pass
0 fail
3796 expect() calls
Ran 799 tests across 54 files.
exit=0

$ bun run typecheck            exit=0
$ bun run verify:style         OK (diff-scoped · 113 owned files · 4 rules)
$ bun run verify:capability    OK
$ bun run build                done, exit=0

$ node scripts/refresh-program-lock-facts.mjs --check
refresh-program-lock-facts: FAILED: program lock facts are stale
exit=1
```

The `--check` staleness is the same well-established, pre-existing HEAD-drift condition documented in every prior verify/archive report in this repository — `verify:capability` (the authoritative half of the proof) is green. Not caused by, and not fixable inside, verify; owned by archive, which forces the recovery pair anyway.

## 4. Hard boundaries and tool-name restrictions — verified across the full branch range

```
$ git diff --stat main..HEAD -- runtime/engram-client.ts runtime/engram-pin.ts \
      contracts/package-contract.md contracts/runtime-dependency.md openspec/specs/ \
      scripts/compute-candidate-identity.mjs scripts/verify-capability-manifest.mjs .git/
[empty]

$ git diff --stat main..HEAD -- agents/ assets/agents/
 agents/journal-candidate-agent.md        | 8 +++++++-
 assets/agents/journal-candidate-agent.md | 8 +++++++-
 2 files changed, 14 insertions(+), 2 deletions(-)

$ git diff main..HEAD -- extensions/ runtime/ __tests__/ agents/ | grep -nE "accounting_|engram_save|engram_reject|engram_void|engram_supersede"
[empty, outside this change's own citations of the rules]
```

`runtime/engram-client.ts`/`runtime/engram-pin.ts` untouched (`design.md` §5). Only `journal-candidate-agent.md` (and its required `assets/agents/` mirror) among the 10 agent files. No `accounting_*` or write-shaped `engram_*` tool name anywhere in the diff.

## 5. Requirement-by-scenario verification

### REQ-ENG-005 — Agent-driven institutional-memory search

| Scenario | Verdict | Evidence |
| --- | --- | --- |
| Agent-supplied query, host-supplied scope | PASS | `__tests__/extension.test.ts` "returns found with parsed results..." asserts `calledArgs.query` equals the agent's query and `calledArgs.scope.ruc` equals the local pointer's RUC — never agent-supplied |
| No scope known yet | PASS | `institutionalMemoryExecute` checks `scope.company?.ruc === undefined` first, returns `{status: "no-scope-known"}` before ever calling `spawnEngramClientFn` — re-read directly in `extensions/register.ts` |
| Engram unreachable | PASS | Non-healthy `spawnEngramClientFn` result maps to `{status: "unavailable", reason}`, never a thrown error — confirmed by the "unavailable" test case |

### REQ-ENG-006 — Memory shapes proposals, never authority

| Scenario | Verdict | Evidence |
| --- | --- | --- |
| No gate wiring exists | PASS | `git diff main..HEAD` grep for gate/materiality references (§4) — no matches outside citation |
| Candidate artifact shape is unchanged | PASS | `journal-candidate-agent.md`'s `## Output` section (candidate-entries artifact shape) is byte-identical before/after this change — only the new `## Institutional memory` section was added, confirmed by `diff` against the pre-change file at `pi-engram-integration`'s tip |

**All 5 scenarios: PASS**, freshly re-verified against the actual code at HEAD `c660656`.

## 6. Findings from apply, carried honestly (not new defects, disclosed at the time)

- Exploration's original claim that `pi.registerTool()` was never used in this codebase was corrected during apply: `extensions/fiscal-guard.ts` already calls it 5 times. This change follows that established pattern exactly rather than inventing a new one.
- The `assets/agents/` byte-for-byte mirror requirement (`__tests__/agents.test.ts`) was not anticipated in the original task wording and was caught by the first full verification pass, then fixed in the same apply session (`tasks.md` T-007/T-010 document this).

No new defect was found during this verify pass beyond what `tasks.md` already disclosed.

## 7. next_recommended

`archive` — 2/2 requirements, 5/5 scenarios, 0 blockers. The `--check` staleness (§3) is archive's own responsibility, per this repository's established precedent.
