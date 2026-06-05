# Difficulty-scaling tuning config + party-size helpers

Add the tuning constants and pure helper functions that the spawn-rate, enemy-damage,
and miniboss-HP scaling will all build on. 1–4 players are baseline (factor 1.0);
each additional player from 5 up to the 16 cap adds a small marginal increment.
No spawn/damage/HP behaviour changes yet — this is the shared foundation.

## Acceptance Criteria

- `game/server/config.js` exports `DIFFICULTY_SCALE_MIN_PLAYERS` (value `4`) and three
  small per-player increment constants: `DIFFICULTY_SPAWN_RATE_PER_PLAYER`,
  `DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER`, and `DIFFICULTY_MINIBOSS_HP_PER_PLAYER`
  (each a small positive fraction, e.g. ~0.05–0.12; tunable).
- A pure helper `difficultyExtraPlayers(count)` returns the number of players above the
  baseline threshold: `0` for any `count` in 1..4, `1` at 5, increasing by 1 per player,
  and capped at `MAX_PLAYERS - DIFFICULTY_SCALE_MIN_PLAYERS` (i.e. `12`) for any
  `count >= 16`. Never returns a negative value (count 0 → 0).
- A pure helper `difficultyScaleFactor(count, perPlayerIncrement)` returns
  `1 + difficultyExtraPlayers(count) * perPlayerIncrement` — exactly `1.0` for count 1..4,
  larger for 5..16, and clamped at the 16-player value for count > 16.
- A live-count helper `runPlayerCount(gameState)` returns the number of players currently
  in the run (`Object.keys(gameState.players).length`), clamped to `[0, MAX_PLAYERS]`,
  and `0` when there is no gameState/players map. This is the count the scaling reads, so
  drop-in JOIN raises it and LEAVE lowers it.
- A new automated test (e.g. `game/server/test/difficulty_scale_config.test.js`) exercises:
  baseline (counts 1,2,3,4 → `difficultyScaleFactor` === 1.0), scaling (counts 5, 8, 16 →
  strictly increasing factors), and the clamp (count 16 === count 20 === count 100), plus
  `runPlayerCount` clamping above 16 and tracking a changing players map.

## Technical Specs

- `game/server/config.js`: add the four constants, the three helper functions
  (`difficultyExtraPlayers`, `difficultyScaleFactor`, `runPlayerCount`), and include all of
  them in `module.exports`. Reuse the existing `MAX_PLAYERS = 16` constant for the cap.
  Keep helpers pure/synchronous so later sub-tickets can call them from `objectives.js`,
  `simulation.js`, and `progression.js`.
- `game/server/test/difficulty_scale_config.test.js`: new vitest file importing from
  `../config.js`. Follow the style of existing tests in `game/server/test/`.

## Verification: code
