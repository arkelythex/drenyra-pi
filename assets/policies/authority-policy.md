# Authority Policy (v0.1)

> Scope: agents, commands, and chains of the evidence-driven accounting harness.
> Status: v0.1 operating policy. Applies to every role shipped under `agents/`.

## Authority modes

The harness recognizes exactly four authority modes in strict order:

1. `ASK` — query and read only.
2. `ANALYZE` — investigate, analyze, and propose candidates.
3. `PREPARE` — assemble ready-to-execute proposals and coordination packages.
4. `EXECUTE` — perform approved, receipt-bound mutations.

Every agent ships with a documented authority ceiling. Scout, analyst, and
refuter roles operate at `ASK`–`ANALYZE`. The close-controller operates at
`PREPARE` for coordination only. No agent ships with `EXECUTE`.

## No autonomous filing

**The harness never files anything autonomously with the Peruvian tax
authority.** All filings are prepared as evidence-cited proposals and require
explicit human approval and a signed receipt before any submission. Filing is
out of scope for v0.1: the harness prepares, the responsible professional
files.

## No irreversible posting without approval

**No irreversible posting happens without explicit approval.** A posting is
irreversible when it changes accounting state that cannot be retracted
silently. Every such action requires:

1. A complete canonical scope binding.
2. A candidate prepared with cited evidence.
3. An explicit approval from a human approver at the R2 approval gate.
4. A signed receipt binding mission, evidence, scope, and executed target.

A completion receipt never self-authorizes its own action. A missing
approval, a missing receipt, or an untrusted key blocks the operation and
changes nothing.

## Agents never perform EXECUTE work

- Agent permissions are broad-deny with narrow allows: an agent starts with
  no tools and receives only role-required read/query tools plus a bounded
  artifact-write capability for its own role artifact.
- Agents never sign receipts, never grant authority, and never perform
  EXECUTE work.
- Memory notes never grant authority: only the file-backed authorization,
  evidence, and receipt state decides.

## National alignment

- **No autonomous filing is preserved.** Peruvian digital-government strategy
  does not change the harness's authority model: nothing is filed or submitted
  without explicit human approval (see no-autonomous-filing above).
- **State-entity exchange requires authorization.** [PIDE](https://guias.servicios.gob.pe/creacion-servicios-digitales/reutilizables/interoperabilidad)
  enables electronic data exchange among more than 450 public entities; any use
  by or for a private harness requires applicable authorization, purpose, and
  agreements — no automatic access.
- **Public-sector AI governance is context.** [ENIA 2026–2030](https://busquedas.elperuano.pe/dispositivo/NL/2511535-1)
  (RM N.° 152-2026-PCM) establishes OIA and Catálogo IA Perú for the public
  sector; it is not a private-sector legal classification of Drenyra's tax AI,
  and it grants no authority here.
- The [ENGD 2026–2030](https://www.gob.pe/99097-estrategia-nacional-de-gobierno-de-datos-2026-2030)
  (approved by [RM N.° 049-2026-PCM](https://www.gob.pe/institucion/pcm/normas-legales/7739698-049-2026-pcm),
  derived from the Política Nacional de Transformación Digital 2030) data
  quality, management and privacy action line frames the governed-data
  direction.
