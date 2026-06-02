## Avoid Duplicating Phase Step Range On Client

The renderer hard-codes `PHASE_STEP_RANGE = 6` to match the server key-item definition. The server remains authoritative, so this is safe, but a future balance change could make the highlight disagree with actual `phase_step` range.

### Acceptance Criteria

- The client highlight range is derived from shared data, server state, or a focused test that catches client/server range drift.

## Remove No-op Phase Step Test Assignment

`server/test/phase_step.test.js` contains `p1.x = p1.x; p1.z = p1.z;` in the nearest-ally setup. It is harmless, but it makes the positioning intent harder to read.

### Acceptance Criteria

- The nearest-ally test setup either removes the no-op assignment or replaces it with explicit meaningful caster coordinates.
