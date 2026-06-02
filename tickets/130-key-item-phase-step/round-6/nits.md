## Share Phase Step Range With The Client

The client renderer hard-codes `PHASE_STEP_RANGE = 6` with a comment saying it must match the server definition. This is correct today, but it can drift if the key item balance changes later.

### Acceptance Criteria
- The client derives the Phase Step targeting range from server-provided key item definitions or a shared constant instead of duplicating the numeric value.
