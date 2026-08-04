# themes/

Pi themes for Drenyra Pi, declared via the `pi.themes` manifest entry
(REQ-SKPT-003).

## fiscal-operator

Exactly one theme with light and dark variants in one manifest-resolved
asset:

```text
themes/fiscal-operator/
  manifest.json                 # name + light/dark variant resolution
  fiscal-operator-light.json    # light palette (Pi theme schema)
  fiscal-operator-dark.json     # dark palette (Pi theme schema)
```

Conformance: `__tests__/content.test.ts` (SC-SKPT-003).
