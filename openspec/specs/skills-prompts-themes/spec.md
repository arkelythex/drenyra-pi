# Skills, Prompts, and Themes Specification

## Purpose

Defines the packaged operating content for v0.1: 1–3 Drenyra skills, the persona and command prompts, one fiscal-operator theme, and real assets for chains, policies, and schemas — replacing the current placeholder stubs so the package ships usable operating guidance, not empty directories.

## Requirements

### Requirement: REQ-SKPT-001 — Packaged skills

The system MUST ship between 1 and 3 Drenyra skills with real instructional content (scope discipline, evidence citation, chain operation) and MUST NOT ship skill stubs.

### Requirement: REQ-SKPT-001a — Design 03 layer model

The system MUST document the Design 03 three-layer skill model (Foundation, Peru, Practice/sector) in skills/README.md, MUST declare the layer and jurisdiction of each shipped skill in its frontmatter metadata, and MUST document the required per-skill metadata fields (identifier, version, jurisdiction, validity period, normative sources, declared inputs/outputs, required permissions, maximum autonomy, tests and fixtures, contract compatibility, signature/checksum, replacement and retirement policy) without changing the shipped skill count in v0.1.

### Requirement: REQ-SKPT-002 — Prompts

The system MUST ship a persona prompt and command prompts covering the 14 intended commands, and MUST keep prompts aligned with the command surface and authority doctrine.

### Requirement: REQ-SKPT-003 — Theme

The system MUST ship exactly one theme (fiscal-operator) with light and dark variants wired through the pi manifest.

### Requirement: REQ-SKPT-004 — Chain assets

The system MUST ship real chain assets under assets/chains/ describing the monthly-close, reconcile, verify, and evidence chains.

### Requirement: REQ-SKPT-005 — Policy assets

The system MUST ship policy documents under assets/policies/ that encode every v0.1 non-goal: no autonomous filing with the Peruvian tax authority, no irreversible posting without approval, no free interpretation without evidence, no material tax decisions from LLM alone, and no silent modification of closed periods.

### Requirement: REQ-SKPT-006 — Schema assets

The system MUST ship real JSON Schema documents under assets/schemas/ for the scope binding, evidence, and authority envelopes.

### Requirement: REQ-SKPT-007 — Manifest conformance

The system MUST satisfy pi manifest conformance: pi.prompts, pi.skills, and pi.themes entries resolve to real files, and verify-package-files MUST check the new asset tree.

### Requirement: REQ-SKPT-008 — Policy assertions

The system MUST include tests that assert each v0.1 non-goal is encoded in a policy document.

## Scenarios

#### Scenario: SC-SKPT-001 — Package verification passes

- GIVEN the packaged extension directory
- WHEN verify-package-files runs
- THEN it passes and confirms prompts, skills, themes, and the assets tree resolve

#### Scenario: SC-SKPT-002 — Non-goals encoded in policy

- GIVEN the policies directory
- WHEN policy content assertions run
- THEN each v0.1 non-goal maps to at least one explicit policy statement

#### Scenario: SC-SKPT-003 — Theme loads

- GIVEN the installed package
- WHEN the theme is selected
- THEN it renders (or degrades structurally without errors) and the manifest entry resolves

#### Scenario: SC-SKPT-004 — Skills have real content

- GIVEN each packaged skill file
- WHEN inspected
- THEN its body contains operational instructions, not placeholder text

#### Scenario: SC-SKPT-005 — Command prompts aligned

- GIVEN the prompts directory
- WHEN each prompt is matched to the command surface
- THEN every one of the 14 intended commands has a prompt and no prompt references an unregistered command

## Out of Scope

Post-v0.1 operating content (SIRE, advanced reconciliation, AP/AR, monthly taxes, continuous audit) and any theme or skill beyond the single v0.1 set.
