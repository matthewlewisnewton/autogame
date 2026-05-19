# Throttle enemyHit sound to prevent oscillator stacking

`cardUsed` handler calls `playSound('enemyHit')` once per entry in `data.hits`. A wide summon hitting 5+ enemies fires 5+ simultaneous oscillators, producing a harsh overlapping blip.

Throttle so that at most one `enemyHit` sound plays per card event (or per short time window), regardless of hit count.

## Acceptance Criteria
- A single `cardUsed` event with multiple hits plays at most one `enemyHit` audio cue.
- The first hit in the array still triggers the sound (no silence on multi-hit cards).
- Single-hit cards behave identically to current behavior.
- `npm test` passes with 0 failures.

## Technical Specs
- **File**: `game/client/main.js` — in the `cardUsed` socket handler (~line 1113-1125), move `playSound('enemyHit')` outside the `for` loop over `data.hits`, or guard it with a flag so it only fires on the first hit entry.
- **File**: `game/client/test/main.test.js` — add or update a test verifying that a multi-hit `cardUsed` payload triggers `playSound` only once.

## Verification: code
