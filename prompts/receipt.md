# /drenyra:receipt

Show a stored receipt or verify one locally against the trusted-key registry.

## Usage

- `/drenyra:receipt <id>` — show the stored record.
- `/drenyra:receipt verify <id>` — verify content, signature, signer trust,
  key lifecycle, bound scope, and executed target.

## Output

- The verification matrix: content-valid, signature-valid, signer-trusted,
  in-currency, bound scope, executed target — or the exact rejection reason
  (tampered, unknown signer, expired key, revoked key).
