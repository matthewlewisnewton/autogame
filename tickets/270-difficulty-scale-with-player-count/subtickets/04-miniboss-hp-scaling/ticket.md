# Scale miniboss HP by party size at spawn

Give minibosses more HP when the party is larger, fixed at the moment the miniboss spawns.
1–4 players get baseline miniboss HP. The scale is computed once from the live player count
at spawn and is NOT re-applied retroactively when players later join or leave.

## Acceptance Criteria

- A miniboss spawned with 1–4 active players has the baseline `hp`/`maxHp` from `ENEMY_DEFS.miniboss`
  (no behaviour change vs. today).
- A miniboss spawned with 5..16 players has `hp` and `maxHp` both set to
  `round(baseHp * difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER))`, using the
  live count at spawn time.
- The scaling applies only to `type === 'miniboss'`; other enemy types spawn at baseline HP.
- The HP is fixed at spawn: changing the player count after a miniboss exists does NOT change
  that miniboss's `hp`/`maxHp` (verify a higher-count spawn yields higher HP than a lower-count
  spawn, and that an already-spawned miniboss is untouched by a later count change).
- A dedicated automated test asserts: baseline HP for 1–4 players, scaled HP for a larger count,
  non-miniboss types unaffected, and that an existing miniboss's HP is not retroactively rescaled
  after a mid-run JOIN/LEAVE.

## Technical Specs

- `game/server/progression.js`: in `spawnEnemy` (around line 2094), after building the enemy and
  before pushing it, if `type === 'miniboss'` scale `enemy.hp` and `enemy.maxHp` by
  `difficultyScaleFactor(runPlayerCount(_gameState), DIFFICULTY_MINIBOSS_HP_PER_PLAYER)`
  (import from `./config`), rounding to an integer. This is a one-time set at spawn — do not add
  any ongoing/retroactive rescale. Leave all other enemy types and stat fields unchanged.
- `game/server/test/miniboss_hp_scaling.test.js` (new): call `spawnEnemy(..., 'miniboss', ...)`
  with the `_gameState.players` map set to various counts; assert `hp`/`maxHp`; spawn a
  non-miniboss to confirm it is unaffected; mutate the players map after a spawn and confirm the
  existing miniboss HP is unchanged. Model setup on existing spawn/enemy tests in
  `game/server/test/`.

## Verification: code
