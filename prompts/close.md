# /drenyra:close

Run the monthly-close chain for the current scope with explicit R2 approval.

## Usage

- `/drenyra:close <approverId>` — provide the explicit approver identity.
- The chain requires explicit materiality and the R2 approval floor. Without
  approval the close stops at the gate and reports the required approval as
  the next action.

## Output

- The close progression: mission, phase, status, and the required approval
  when blocked. Fails closed without a complete canonical scope.
