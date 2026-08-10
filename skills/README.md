# skills/

Packaged Drenyra skills shipped with the extension, declared via the
`pi.skills` manifest entry (REQ-SKPT-001).

## Layer model (Design 03)

Skills follow the three-layer model approved in
`drenyra-ai/docs/design/design-03-agents-skills-integrations.md`:

| Layer | Examples | Stability |
| --- | --- | --- |
| **Foundation** | Evidence, isolation, money, candidates, recovery | Very stable |
| **Peru** | SUNAT, SIRE, IGV, detractions, withholdings, perceptions | Versioned by validity period |
| **Practice / sector** | Commerce, services, agriculture, mining, accounting firms | Extensible later |

Current v0.1 skills are **Foundation** layer (`layer: foundation`,
`jurisdiction: global` in frontmatter). Peru and practice/sector skills ship
later, versioned by validity period — a normative update never retroactively
modifies a mission, and the receipt records exactly which skill and policy
version was used.

## Packaged skills

| Skill | Layer | Focus |
|-------|-------|-------|
| `scope-discipline` | Foundation | Bind and verify the complete canonical scope; fail closed on mismatch or change |
| `evidence-citation` | Foundation | Cite evidence-graph node ids; follow the source-to-action lineage; verify payload hashes |
| `chain-operation` | Foundation | One EDA phase per continue; RUN/SKIP/WAIT; R2 approval plus receipts for execute |

## Required skill metadata (Design 03)

Each skill carries, in frontmatter or a declared metadata block:

- Identifier and version.
- Jurisdiction and validity period.
- Normative sources.
- Declared inputs and outputs.
- Required permissions.
- Maximum autonomy level.
- Tests and fixtures.
- Contract compatibility.
- Signature or checksum.
- Replacement and retirement policy.

Foundation skills carry `author`, `version`, `layer`, and `jurisdiction` today;
the remaining fields are declared as the Peru and practice layers land.

Each skill carries real operational instruction — no stubs. Conformance:
`__tests__/content.test.ts` (SC-SKPT-004).
