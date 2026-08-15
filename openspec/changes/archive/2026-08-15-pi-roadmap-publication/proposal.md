# Reconcile the public roadmap and architecture marker

## Intent

Correct the stale Phase 0 checklist marker in `ROADMAP.md` only when independently verifiable evidence shows that both the roadmap and architecture documentation are publicly accessible.

The repository currently contains `ROADMAP.md`, `docs/architecture.md`, and supporting architecture documentation, but repository presence alone is not publication evidence. `RELEASING.md` also identifies the repository as private, so the marker must remain unchanged unless public, unauthenticated publication can be verified.

## Current-state gap

`ROADMAP.md` still lists **“Public roadmap and architecture published”** as incomplete. The marker may be stale, but changing it based only on local files, private-repository access, intent, or an unverified claim would make the roadmap less trustworthy.

This change establishes an evidence-first reconciliation: verified publication permits the marker update; missing, private, partial, or ambiguous evidence results in no roadmap change.

## Scope

### In scope

- Verify public publication evidence for both:
  - the Drenyra Pi roadmap; and
  - the Drenyra Pi architecture documentation.
- Require evidence to be accessible without repository credentials or privileged access and to identify the published Drenyra Pi documents clearly.
- If both publications are verified, change only the Phase 0 marker in `ROADMAP.md` from unchecked to checked.
- Record the evidence and verification outcome in the change's implementation or verification artifacts rather than adding publication claims elsewhere.
- Keep the work below the 400 authored-changed-line budget and any stricter local policy. The intended product edit is one checklist marker.

### Evidence rules

Publication evidence is sufficient only when a reviewer can reproduce it and confirm all of the following:

1. A public, unauthenticated location is reachable for the roadmap.
2. A public, unauthenticated location is reachable for the architecture documentation.
3. Each location clearly corresponds to Drenyra Pi and exposes the relevant document content, rather than only a repository title, placeholder, redirect to authentication, screenshot, or private preview.
4. The evidence is current enough to support the checklist claim at verification time.

A local checkout, authenticated GitHub view, private repository URL, planned publication, cached claim, or evidence for only one of the two documents is insufficient. If any criterion cannot be verified, the marker remains unchecked and the change reports the missing evidence.

### Out of scope

- Publishing the repository or any document.
- Changing repository visibility, hosting, permissions, release automation, npm publication, tags, or GitHub releases.
- Editing roadmap phases, dates, wording, sequencing, contracts, or any checklist item other than the publication marker.
- Editing `README.md`, `docs/architecture.md`, `docs/architecture/ecosystem-boundaries.md`, policy assets, or any national-alignment content.
- Reframing national alignment as implemented compliance or changing the fail-closed, no-autonomous-filing, authorization, privacy, interoperability, or digital-signature boundaries.
- Code, tests, dependencies, generated files, commits, pushes, or pull requests in this proposal phase.

## Affected areas

| Area | Expected impact |
| --- | --- |
| `ROADMAP.md` | A later apply phase may change only the Phase 0 publication checkbox, and only after both evidence requirements pass. |
| Public publication locations | Read-only verification sources; no remote mutation. |
| `openspec/changes/pi-roadmap-publication/` | Holds planning and later evidence artifacts for this bounded reconciliation. |
| National-alignment and architecture documentation | Explicitly preserved without content changes. |
| Runtime and release behavior | No impact. |

## Product outcome

Maintainers and roadmap readers can trust the Phase 0 publication marker as an evidence-backed statement. The change either produces one accurate checkbox update or an explicit no-op when publication cannot be verified; it never manufactures completion from local availability alone.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Private or authenticated access is mistaken for public publication | The roadmap overstates public availability | Verify from an unauthenticated context and reject login-gated or permission-dependent evidence. |
| Only one document is public | A compound checklist item is marked complete prematurely | Require separate, reproducible evidence for both roadmap and architecture. |
| Public content is a placeholder or belongs to another Drenyra project | Evidence does not support the Drenyra Pi claim | Confirm project identity and relevant document content at each location. |
| Scope expands into national-alignment or architecture edits | Carefully bounded positioning and compliance language may drift | Limit any later product diff to the single roadmap checkbox; treat all related docs as protected. |
| External publication disappears after verification | The marker can become stale again | Record the checked locations and verification time in change evidence; future loss is handled by a separate reconciliation. |
| A documentation-only fix accumulates unrelated cleanup | Review becomes harder and rollback less reliable | Enforce the 400-line ceiling and any stricter local limit; reject incidental edits. |

## Rollback

If the publication evidence is later shown to have been invalid at the time of reconciliation, revert only the Phase 0 publication checkbox in `ROADMAP.md` from checked to unchecked. Do not revert or modify national-alignment documentation, architecture content, code, release configuration, or unrelated roadmap state.

If evidence is unavailable during implementation, no product-file edit occurs, so no rollback is needed.

## Success criteria

- Public, unauthenticated, reproducible evidence is verified separately for the Drenyra Pi roadmap and architecture documentation.
- Evidence clearly identifies Drenyra Pi and exposes the relevant document content.
- When both checks pass, the only product-document change is the existing Phase 0 publication checkbox in `ROADMAP.md` changing from unchecked to checked.
- When either check fails or remains ambiguous, `ROADMAP.md` is unchanged and the missing evidence is reported.
- `README.md`, architecture documents, national-alignment content, policy assets, code, dependencies, release behavior, and all unrelated roadmap entries remain byte-for-byte unchanged.
- Authored changes remain below 400 lines and comply with any stricter local review policy.
- This proposal phase creates no code change, commit, push, or pull request.

## Proposal question round

Automatic execution prevents an interactive question round before this proposal. The following product questions and working assumptions should be reviewed before any apply phase:

1. **What is the authoritative public location for each document?** Assumption: roadmap and architecture may use different public URLs, but both must be reachable without authentication.
2. **Must the public copies match the repository documents exactly?** Assumption: they must clearly expose the corresponding current Drenyra Pi content; cosmetic hosting transformations are acceptable, but placeholders, summaries, or materially stale copies are not.
3. **What should happen when evidence is partial or temporarily unreachable?** Assumption: fail closed, leave the marker unchecked, and report a no-op rather than retrying indefinitely or inferring publication.
4. **Does the compound marker require both the main architecture document and every supporting architecture page?** Assumption: the main Drenyra Pi architecture publication is required; supporting pages may strengthen evidence but are not independently required unless the public architecture entry point claims to publish them.

These assumptions preserve the smallest useful slice: evidence-backed reconciliation of one marker, with publication work and all adjacent documentation changes deferred.

---

> **Archive note (2026-08-15):** this proposal was preserved from a stale prior-session worktree. Its intent — verifying public roadmap/architecture publication before checking the ROADMAP Phase 0 marker — was fulfilled by the pi-program-status-reconciliation change (2026-08-14): the marker is checked under the user-decided public repository policy.
