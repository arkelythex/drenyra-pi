# Trust Model — Drenyra Pi (Pi-native Accounting Operations Harness)

> **Last updated:** 2026-08-11 (Design 4 — persistence, security, and recovery).

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Model in one line

**Pinned verified runtime, fail-closed.** Drenyra Pi trusts exactly one engine — the exact version of Drenyra AI it pinned and verified at install — and every fiscal action is default-denied until scope and authority are proven.

## Trust boundaries

### 1. The runtime is pinned, verified, package-local

- An exact, checksum-verified version of Drenyra AI is installed inside the package tree.
- **Never `PATH`.** Ambient binaries are not trusted for fiscal operations.
- Verification runs on install (`doctor` confirms); a failed check makes the runtime unusable.

### 2. Tool safety is default-deny

- Fiscal tools follow **broad-deny, narrow-allow** permissions.
- Permissions are part of the contract and reviewed like code.

### 3. Context is threaded, never assumed

- Company (RUC) and fiscal period are loaded at startup and threaded through every tool, command, and subagent.
- Missing context fails closed: the operation does not proceed.

### 4. Authority comes from Drenyra AI gates and humans

- Drenyra Pi never invents authority. Missions, candidates, gates, and approvals run in Drenyra AI.
- Explicit human approval is required for material actions (R2/R3 chains such as monthly close).

      ### 5. Memory informs; it never authorizes
    
      - Drenyra Engram provides context and institutional knowledge.
      - No memory observation is ever treated as permission to act.
      - **Memory never feeds a gate.** Gates (`mission-state`, `receipt`,
          `approval`) are frozen contracts in drenyra-ai; memory is context for
          proposing, never input to a gate decision.
      - **Memory decides WHAT to propose, never HOW MUCH review.** Institutional
          patterns ("this provider always has 12% detracción", "this account was
          reclassified last month by human error") shape which candidate an agent
          drafts; review depth is decided only by the deterministic materiality
          policy (BigInt thresholds, frozen in drenyra-ai).

  ### 6. Authoritative state is persisted, never conversational (Design 4)

  - Authoritative state lives in persisted events, evidence, and receipts —
      never in the conversation or the model's memory. The harness's file-backed
      stores are dev/demo only; production transactions, concurrency, and durable
      persistence belong to `drenyra-ai`.
  - **Documents are untrusted input.** A PDF, XML, or description can never
      inject agent instructions, modify permissions, or request additional tools;
      document content is sanitized before it reaches any agent.
  - Secrets never appear in prompts, logs, or public receipts; keys live in KMS
      and connectors are revocable.
  - Signatures are verified and signer trust is explicit; receipts are chained
      in an append-only ledger that cannot be rewritten.
  - The Guardian Angel reviews frozen candidates in read-only mode and never
      approves.
  - **The model may be compromised or wrong and still must not be able to skip a
      gate, cross a tenant, forge an approval, or rewrite the ledger.**

## Fail-closed default

When the pin is unverifiable, the context is missing, or permissions are insufficient, Drenyra Pi **fails closed**: the command refuses, explains why, and waits for a human. There is no ambient-binary fallback and no permission escalation.

## National alignment

National alignment reinforces — never weakens — the trust model:

- **Integrity receipts ≠ legal digital signatures.** Internal Ed25519 receipts verify that the harness ran a verified runtime over append-only evidence. They are not Peruvian legally-valid digital signatures and confer no legal signature status.
- **Fail-closed and no-autonomous-filing stay.** Neither the [ENGD 2026–2030](https://www.gob.pe/99097-estrategia-nacional-de-gobierno-de-datos-2026-2030) (approved by [RM N.° 049-2026-PCM](https://www.gob.pe/institucion/pcm/normas-legales/7739698-049-2026-pcm), derived from the Política Nacional de Transformación Digital 2030) nor the data-protection context changes the default-deny posture: no State-entity filing or exchange happens without human action.
- **State-entity exchange is bounded.** [PIDE](https://guias.servicios.gob.pe/creacion-servicios-digitales/reutilizables/interoperabilidad) enables exchange among more than 450 public entities; any Drenyra integration would require applicable authorization, purpose, and agreements — no automatic access is assumed.
- **Privacy by design tracks the new [Reglamento de la Ley N.º 29733](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus)** (DS N.º 016-2024-JUS) as context for how company data is collected, used, and retained.
- **Public-sector AI governance is context.** [ENIA 2026–2030](https://busquedas.elperuano.pe/dispositivo/NL/2511535-1) (RM N.° 152-2026-PCM) establishes OIA and Catálogo IA Perú for the public sector; it is not a private-sector legal classification of Drenyra's tax AI.

## Interaction with consumers

Drenyra Pi is the operator layer: it packages the Drenyra AI experience for Pi and enforces scope at the surface. The engine's contracts remain the source of truth for fiscal behavior.

## Operational consequences

- A failed pin verification blocks every fiscal command, not just the one that tripped it.
- Permission changes ship as reviewed contract changes, never as ad hoc edits.
