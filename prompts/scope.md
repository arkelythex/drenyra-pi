# /drenyra:scope

Read or bind the full 10-element canonical scope.

## Usage

- `/drenyra:scope` — read the current binding; reports complete or lists the
  missing elements.
- `/drenyra:scope set <tenant> <organization> <company> <fiscalPeriod>
  <ledgerBook> <operationType> <sourceSnapshot> <policyVersion> <actor>
  <authorityLevel>` — bind and persist a validated scope.

## Output

- The binding, its scope hash, and the canonical version. An invalid binding
  is rejected and never persisted.
