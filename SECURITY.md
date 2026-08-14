# Security Policy

## Scope

This repository covers the Drenyra Pi harness: persona, `/drenyra:*` commands, subagents, RDA chains, tool permissions, themes, and the pinned Drenyra AI runtime bootstrap. It operates **fiscal workflows** — treat confidentiality, integrity, and auditability as product safety requirements.

## Reporting a vulnerability

Use **GitHub Private Vulnerability Reporting**: open the **Security** tab of this repository → **Report a vulnerability**. Do not open a public issue for security defects.

When reporting, include:

- Affected version/commit and component (`commands`, `chains`, `agents`, `runtime`, `permissions`, …)
- A minimal, safe reproduction (no real company data, no RUCs, no credentials)
- Expected vs. actual behavior
- Impact assessment

## Out of scope

- Production credentials, tokens, or customer data — never attach these
- Vulnerabilities in Drenyra, Drenyra AI, or Drenyra Engram (report in their own repos)
- Issues in the pinned Drenyra AI runtime (report to `arkelythex/drenyra-ai`)
- Brute-force or spam abuse of public endpoints

## Handling

Reports are acknowledged within 5 business days. A fix, workaround, or risk acceptance is communicated before public disclosure. Pre-alpha project: fixes land as patch releases on `main` with an advisory note in the release.

## National alignment

Security and privacy work is positioned against the Peruvian national strategy — as direction, not implemented certification:

- [ENGD 2026–2030](https://www.gob.pe/99097-estrategia-nacional-de-gobierno-de-datos-2026-2030) (approved by [RM N.° 049-2026-PCM](https://www.gob.pe/institucion/pcm/normas-legales/7739698-049-2026-pcm), derived from the Política Nacional de Transformación Digital 2030) frames a trusted, innovative, secure digital ecosystem; its data quality, management and privacy action line maps to this harness's governed-data and privacy-by-design work.
- The new [Reglamento de la Ley N.º 29733](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus) is DS N.º 016-2024-JUS — tracked as personal-data-protection context.
- Internal Ed25519 integrity receipts verify harness state; they are **not** Peruvian legally-valid digital signatures.
- No State-entity exchange is assumed: [PIDE](https://guias.servicios.gob.pe/creacion-servicios-digitales/reutilizables/interoperabilidad) integration, if ever pursued, requires applicable authorization, purpose, and agreements.

## Responsible use

This software is proprietary and confidential (see [LICENSE](LICENSE)). Reporting a vulnerability does not grant any right to copy, modify, or distribute the software.
