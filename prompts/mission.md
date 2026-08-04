# /drenyra:mission

Start an EDA mission for the current scope and intent over the durable
mission stores.

## Usage

- `/drenyra:mission <intent>` with intent one of: monthly-close, correction,
  reconciliation, invoice-review, compliance-check.

## Output

- The new mission: id, intent, status, the full 13-step plan, and the bound
  authority mode. Fails closed without a complete canonical scope.
