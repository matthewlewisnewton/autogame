# Audio: Combat Event Cues

Wire `playSound()` calls into existing combat events so major actions produce audio feedback.

## Acceptance Criteria
- Playing a weapon or summon card triggers `playSound('card')`.
- When an enemy is hit (HP decreases via `cardUsed`), `playSound('enemyHit')` is called.
- When the local player takes damage (HP decreases between state updates), `playSound('playerDamage')` is called.
- When loot is picked up (currency increases), `playSound('loot')` is called.
- When a run completes with victory, `playSound('victory')` is called.
- When a run fails, `playSound('failure')` is called.
- All sound calls respect the `soundEnabled` flag and never throw.

## Technical Specs
- **File:** `game/client/main.js`
  - In the `cardUsed` socket handler (already exists for visual effects), add `playSound('card')` at the top, and `playSound('enemyHit')` for each hit in the `hits` array.
  - In the existing player damage detection block (where `previousPlayerHp` is compared to current HP), add `playSound('playerDamage')`.
  - In the existing currency change detection block (where `_lastCurrency` is compared), add `playSound('loot')` when currency increases.
  - Add socket handlers for `runComplete` and `runFailed` events that call `playSound('victory')` and `playSound('failure')` respectively (these handlers likely already exist for the run summary overlay — add the sound call inside them).
  - No new files needed; all changes are additions to `main.js`.

## Verification: code
