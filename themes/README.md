# themes/

Pi themes for Drenyra Shell, declared as explicit JSON file paths in the
`pi.themes` package manifest entry (REQ-SKPT-003).

Pi loads every discovered JSON file as a complete theme, so this directory
contains no JSON metadata or variant manifest. Each JSON file independently
satisfies the Pi theme schema with `name` and `colors`.

## fiscal-operator

```text
themes/fiscal-operator/
  fiscal-operator-light.json    # light palette (Pi theme schema)
  fiscal-operator-dark.json     # dark palette (Pi theme schema)
```

Conformance: `__tests__/content.test.ts` (SC-SKPT-003).
