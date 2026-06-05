# Scale enemy spawn rate with party size

Make the staggered "survive" run spawner spawn faster as party size grows above 4,
up to the 16 cap. 1–4 players keep the baseline interval. The spawner re-reads the live
player count on every spawn decision, so a mid-run JOIN speeds spawns up and a LEAVE
slows them back down.

## Acceptance Criteria

- For 1–4 active players, the effective interval between survive spawns equals the baseline
  `SURVIVE_SPAWN_INTERVAL_MS` (no behaviour change vs. today).
- For 5..16 players, the effective interval is shorter (spawns faster) by the configured
  per-player increment: effective interval = `SURVIVE_SPAWN_INTERVAL_MS / difficultyScaleFactor(count, DIFFICULTY_SPAWN_RATE_PER_PLAYER)`.
- The count is read live on each spawn tick from `runPlayerCount(gameState)`, so increasing
  the player count mid-run shortens the interval and decreasing it lengthens the interval —
  the rate tracks the live count up and down with no retroactive change to past spawns.
- A dedicated automated test exercises a mid-run JOIN and a mid-run LEAVE and asserts the
  effective spawn interval shortens then lengthens as the live count rises and falls (and
  that 1–4 players stay at baseline).

## Technical Specs

- `game/server/objectives.js`: in the `survive.tickSpawns` throttle check, replace the bare
  `SURVIVE_SPAWN_INTERVAL_MS` comparison with the scaled interval computed from
  `runPlayerCount(gameState)` and `difficultyScaleFactor(count, DIFFICULTY_SPAWN_RATE_PER_PLAYER)`
  (import these from `./config`). Do not change the deterministic per-spawn RNG seeding,
  placement, or miniboss-selection logic — only the throttle interval.
- `game/server/test/spawn_rate_scaling.test.js` (new): drive `tickSpawns` (or assert on the
  computed interval) across player counts and across a mid-run join/leave. Model setup on
  existing survive-spawner tests in `game/server/test/`.

## Verification: code
