# Server: wire delta into the broadcast loop

## Difficulty: medium
## Verification: code
## Depends on: 154-05-server-build-delta

## Goal
Make the per-tick broadcast emit deltas against the last sent snapshot, with
infrequent keyframes + keyframe-on-join, and a monotonic seq.

## Acceptance Criteria
- The broadcast keeps the last-sent full snapshot per lobby and emits
  `buildStateDelta(last, current)` each tick, with an incrementing `seq` and the
  `baselineSeq` it was computed against.
- Every `KEYFRAME_INTERVAL_TICKS` (several seconds, infrequent — it's a
  safety-net/late-joiner mechanism on a reliable channel, not a drift fix) it
  emits a full keyframe instead.
- A newly joined / reconnecting / ready client receives an immediate keyframe
  before any delta.
- No gameplay regression (authoritative float state unchanged internally).

## Technical Specs
- `game/server/index.js` broadcast path (~the `stateUpdate` emit) + uses
  `game/server/stateDelta.js`. Internal state stays full-precision floats.

## Verification: code
- Test: deltas emitted per tick, keyframe at the configured cadence, and an
  immediate keyframe on join. `pnpm test:quick` green.
