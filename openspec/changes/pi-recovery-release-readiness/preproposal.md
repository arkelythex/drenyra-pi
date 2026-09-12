# Pre-Proposal — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6)
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Phase state:** explore **done** → pre-proposal gate **OPEN** → proposal **not authorized**
**Status:** `pending-product-decisions` — `sdd-proposal` MUST NOT be invoked until every blocking decision below is confirmed.

## Gate position

| Gate item | State |
| --- | --- |
| Session preflight | resolved this session — execution `auto`, store `both`, delivery `auto-chain`, review budget 400 |
| Change selection | unambiguous — this change is the only new one; `pi-skills-memory-integration` is a separate, blocked change |
| Exploration artifact | `exploration.md` (447 lines), written and readable |
| Selected research | **unselected** — a purely internal architecture/documentation question; no external prior-art question exists, so the research gate does not block |
| Product decisions | **NOT confirmed** — see §2 and §3 |
| Proposal launch | **blocked** by this artifact |

## 1. Evidence added by the parent after exploration

The exploration ran on a read-only tool surface (`read`, `grep`, `write`) and therefore could not execute anything. Its command-shaped claims were **predictions**; the parent measured the load-bearing one.

**R1 held exactly as predicted.** Creating this change's own directory changes the discovered `activeChanges` set, so:

| Measurement | Result |
| --- | --- |
| `node scripts/refresh-program-lock-facts.mjs --check` | `FAILED: program lock facts are stale` |
| `bun test` | 765 pass / **2 fail** (both `activeChanges` assertions in `__tests__/lock-facts.test.ts`) |
| Recorded `activeChanges` | `['pi-skills-memory-integration']` |
| Discovered live | `['pi-recovery-release-readiness', 'pi-skills-memory-integration']` |

**Repaired with the ordered recovery pair** (refresh → rewrite the normalization-exempt mirror in `openspec/config.yaml` → `--check` → full verification). Final state: identity `dirty-sha256:2011db34343e586e9adbec2764503fbb433c5d52f75429728665f40b62bfd20d`, `--check` current, `bun test` 767 pass / 0 fail, `verify:capability` OK. The mirror write was verified not to move the identity.

**This is the fourth recovery event in this program**, and the four causes are structurally different:

| # | Event | Cause |
| --- | --- | --- |
| 1 | SDD 1 PR 1.5 | an empty untracked directory under `openspec/changes/` polluted `activeChanges` |
| 2 | SDD 1 PR 2.5 | a work unit exceeded its changed-line bound and had to be re-scoped |
| 3 | SDD 1 PR 3.5 | `pi-lens` reformatted two identity-allowlisted files *after* the attempt closed |
| 4 | this exploration | the ordinary act of **opening an SDD change** created a directory |

Event 4 required no mistake, no budget trip, and no tooling failure. It is the routine first step of every future change. **Gap G1 is therefore established by construction, not by inference**, and the exploration's recommendation to document the trigger set is supported by the program's own history.

## 2. Blocking decisions — round 1

These four shape the proposal's existence and boundary. Options and consequences are the exploration's, not restated loosely.

### D1 — Delivery boundary (CRITICAL)

Local `main` is **5 commits ahead of the last known `origin/main`**, no push is recorded, and ≈2,179 verified changed lines exist only as working-tree bytes. `git checkout -- .` / `git stash` / `git reset --hard` would destroy that work **and** resurrect the deliberate `themes/fiscal-operator/manifest.json` deletion. No source change can mitigate this.

- (a) U1 as this change's first unit
- (b) parent-owned delivery step outside SDD
- (c) defer

### D6 — May a second change folder be open (`REQ-CONF-005`)

Canonical `openspec/specs/program-conformance/spec.md#REQ-CONF-005` permits at most **one** open change folder governing conformance/reconciliation status, and requires a superseded change to be archived, not left open. This change would touch `RELEASING.md`, the program doc, and plausibly `openspec/config.yaml` and `capability-manifest.yaml`.

- (a) archive the active change as superseded first
- (b) bind this change's scope to exclude those surfaces — conflicts with the `RELEASING.md` and version fixes, which need them
- (c) record an explicit interpretation that neither change governs the requirement's subject matter

### D3 — Disposition of `pi-skills-memory-integration`

Its `state.yaml` says `blocked_superseded` while native status reports `next: tasks`; `tasks.md` and the `upstream-contract-proposal.md` it cites both **do not exist**; and its blocker lives in the external `drenyra-ai` repository, outside this repository's edit roots.

- (a) archive as superseded (also satisfies `REQ-CONF-005`, coupling with D6a)
- (b) keep open and record the external blocker at program level
- (c) defer

### D2 — Version

`RELEASING.md`'s own policy implies `0.1.0` because both `package-contract` and `runtime-dependency` are frozen at 0.1 and `ROADMAP.md` marks both freezes done; the CHANGELOG records a contrary "verification-only release posture" that appears nowhere in `RELEASING.md`. The 0.4.1 pin bump landed with no version bump, against that document's own rule. The workflow derives the dist-tag from the version, so this decision changes the released channel.

- (a) `0.1.0`
- (b) `0.0.1-prealpha.2`

## 3. Non-blocking decisions — recommended defaults, round 2

Stated so round 1 stays small. Each is a recommendation, not a settled choice.

| # | Decision | Recommended | Rationale |
| --- | --- | --- | --- |
| D4 | Remove the stray `./~/` tree (114 MB / 3,942 files, un-ignored, would be staged by `git add -A`) | remove on the **absolute** repository path + add a `~*` `.gitignore` guard | measured hazard for `git status -uall`, release staging, and the attempt-inventory digest; `rm -rf ~` is catastrophic so the path must never be a glob |
| D5 | `postinstall` silently exits 0 when the compiled installer is absent | loud warning, keep exit 0 | smallest change that removes the silent fail-open without breaking CI's install-before-build ordering |
| D7 | Authority over identity-allowlisted surfaces | grant, with the recovery pair as a mandatory post-step of every unit | measured and already enforced by tests; documentation is the gap |
| D8 | Publication posture | confirm SDD 6 stops at verified gate + honest docs; no npm publication, no `publishConfig` | `RELEASING.md` requires an explicit recorded decision |
| D9 | "Conformance vectors" has no executable runner | rewrite checklist item 3 to name the gates that actually run | the invariant is already transitively gated; a runner is scope inflation |
| D10 | `pi-skills-memory-integration`'s missing artifacts | require the missing artifact or record an explicit absence before any status change | prevents launder of a missing artifact into "done" |

## 4. Scope recommendation, conditional on D1 and D6

The exploration's honest verdict, which I endorse: this is **warranted as a separate change but deliberately small — and the title is the main scoping risk.** "Recovery and release readiness" can absorb Engram integration, npm publication, the pin upgrade, capability promotion, and the blocked change; every one of those is explicitly out of scope.

Its ceiling: **U1 (the commit boundary) is the unit that matters.** U2–U6 are discoverability, documentation, one destructive cleanup, and two decisions. If D1 is answered "handle delivery outside SDD" and D6 "do not open a second change folder", the honest resolution is to deliver U2+U3+U5+U6 as an **amendment to existing surfaces** and close this change as superseded — **not** to pad the scope to fill the SDD 6 slot.

## 5. What must happen next

1. Round 1 answers D1, D6, D3, D2.
2. Round 2 confirms or corrects §3.
3. Only then may `sdd-proposal` be invoked, with this artifact as its confirmed handoff. The proposer must not interview the human or infer consent.
