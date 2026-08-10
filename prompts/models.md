# /drenyra:models

Show the documented model-routing capability registry.

## Output

- The advisory registry `drenyra.model-routing.v1`: the 13 EDA phases and
  their suggested model routing. Suggestions are advisory and never grant
  authority; model output is untrusted proposal data until checks, evidence,
  and approval succeed.
- Provider-agnostic routing (Design 03): models are selected by capability,
  cost, and risk; a mission may use different models per specialty; prompts
  and models are recorded as provenance; changing models never alters
  contracts or authority; no confidence score reduces a required approval;
  results are validated against schemas before entering the Core.
