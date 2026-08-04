# /drenyra:verify

Run the read-only integrity verify chain: source integrity, normalization,
ledger equations, reconciliation correctness, graph integrity, scope binding,
and receipt binding.

## Output

- Per-check verdicts with a structured blocked result on the first failing
  verdict. The chain never mutates accounting outputs.
