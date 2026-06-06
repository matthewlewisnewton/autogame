# Burning deals periodic damage to players and enemies

Wire the BURNING status (from sub-ticket 01) into a periodic damage tick: while
an entity is burning it loses HP on each burn tick (a base tick amount plus a
small extra fire-damage amount), for the burn duration, then stops. This applies
to both players (lit on fire by the fire enemy, 296) and enemies (burned by the
fireball card / wurm, 297/298). Godmode players ignore burn damage, consistent
with existing damage-immunity. Also expose `burningUntil` to clients so the
flame animation sub-ticket can read it.

## Acceptance Criteria
- A new burn-tick pass runs each game-loop tick during the playing phase and
  damages every currently-burning player and enemy. Each burn tick deals a
  fixed amount equal to a base tick damage plus a small extra fire-damage
  amount (defined as named constants).
- Burn damage is interval-gated (e.g. a `burnTickIntervalMs` such as ~500ms,
  tracked per-entity via a `lastBurnTickAt`-style field) so a burning entity
  loses HP repeatedly over time rather than once, and is not melted every
  simulation frame. Damage continues while `isBurning(entity)` is true and
  STOPS once `burningUntil` has passed.
- Player burn damage goes through the existing `damagePlayer` path (or
  equivalent) so a `debugGodmode` player takes ZERO burn damage; enemy burn
  damage goes through `damageEnemy`. Dead/extracted players are skipped.
- Re-application (calling `applyBurning` again before expiry) keeps the entity
  taking burn damage past the original expiry.
- The player hot snapshot exposes `burningUntil` so the client can render the
  flame animation. Enemy snapshots already serialize raw enemy objects, so
  confirm `burningUntil` flows through in broadcast enemy objects.
- New vitest cases assert, by applying burning and advancing time / stepping the
  burn-tick pass: a burning player loses HP over successive ticks and stops
  losing HP after expiry; a burning enemy loses HP over successive ticks and
  stops after expiry; a `debugGodmode` player takes no burn damage; and
  re-application keeps an entity burning (and taking damage) past the original
  expiry.

## Technical Specs
- `game/server/simulation.js`:
  - Add a `function updateBurning()` (export it) that iterates
    `_gameState.players` and `_gameState.enemies`, and for each entity where
    `isBurning(entity)` is true and the per-entity burn interval has elapsed,
    applies burn damage. Use `damagePlayer(playerId, amount)` for players (so
    godmode/invulnerability rules apply automatically) and `damageEnemy(enemy, amount)`
    for enemies. Skip players that are `dead` or `extracted`. Track the last
    burn-tick time per entity (e.g. `entity.lastBurnTickAt`) and gate on a
    `BURN_TICK_INTERVAL_MS` constant, mirroring the minion pulse-interval
    pattern in `updateMinions` (around lines 2213-2220).
  - Define named constants for the burn cadence and per-tick damage, e.g.
    `BURN_TICK_INTERVAL_MS` (~500), `BURN_BASE_TICK_DAMAGE`, and
    `BURN_EXTRA_FIRE_DAMAGE` (a small extra amount). Each burn tick deals
    `BURN_BASE_TICK_DAMAGE + BURN_EXTRA_FIRE_DAMAGE`.
- `game/server/index.js`:
  - Call `updateBurning()` from `runGameLoopTick` in the playing-phase branch
    (around lines 1342-1346, alongside `updateEnemies()` / `updateMinions()`).
    Import it from the simulation module like the other tick helpers.
- `game/server/progression.js`:
  - In `buildPlayerHotSnapshot` (around line 2935, next to `slowedUntil`), add
    `burningUntil: p.burningUntil || 0`. Enemies are serialized raw via
    `buildWorldSnapshot`, so confirm `burningUntil` is present on broadcast
    enemies (no change needed there).
- Add tests (extend `game/server/test/burning_status.test.js` or add a focused
  test file) using `applyBurning` + repeated `updateBurning()` calls / time
  advancement to assert HP loss, expiry, godmode immunity, and refresh.

## Verification: code
