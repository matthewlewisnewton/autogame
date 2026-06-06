# Make BURNING and SLOW mutually exclusive

Make the BURNING (291) and SLOW/cold (290) status effects mutually exclusive on
any entity (players AND enemies): fire and ice cancel, never coexist. Enforce
this inside `applySlow` and `applyBurning` so every existing and future source
inherits the behaviour automatically, and add server tests covering both
application orders on both players and enemies.

## Acceptance Criteria
- Applying burning to an already-slowed entity clears the slow first, then
  ignites it: afterward `isBurning(entity)` is true and `isSlowed(entity)` is
  false.
- Applying slow to an already-burning entity clears the burn first, then slows
  it: afterward `isSlowed(entity)` is true and `isBurning(entity)` is false.
- The two statuses can never be active at the same time on the same entity —
  most-recent application wins.
- Clearing burning also resets its tick clock (`lastBurnTickAt`) so a later
  re-ignition does not dump a burst of catch-up damage ticks.
- The behaviour holds identically for players and for enemies (both are passed
  through the same generic `applySlow` / `applyBurning` helpers).
- Because the client slow ring and burn flame are each driven solely by the
  broadcast `slowedUntil` / `burningUntil` fields (`applySlowIndicator` /
  `applyBurnIndicator` in `game/client/renderer.js`), clearing the opposite
  field on the server means the client shows only the currently-active
  indicator — no client code change is required.
- New/updated server tests assert both orders (slow→burn and burn→slow) on a
  player entity AND an enemy entity, and assert the two are never both active.
- Existing burning and slow tests continue to pass.

## Technical Specs
- `game/server/simulation.js`:
  - In `applySlow(entity, durationMs, factor)`: before (or after) setting
    `slowedUntil`/`slowFactor`, clear any active/lingering burn on the entity —
    set `entity.burningUntil = 0` and `entity.lastBurnTickAt = null` so
    `isBurning(entity)` becomes false and the burn-tick pass stops.
  - In `applyBurning(entity, durationMs)`: before (or after) setting
    `burningUntil`, clear any active/lingering slow — set
    `entity.slowedUntil = 0` (leaving `slowFactor` is harmless since `isSlowed`
    gates on `slowedUntil`) so `isSlowed(entity)` becomes false.
  - Both helpers must remain null-safe (`if (!entity) return;`) and keep their
    existing refresh/clamp semantics for the status being applied.
- `game/server/test/burn_slow_mutual_exclusion.test.js` (new): import
  `applySlow`, `applyBurning`, `isSlowed`, `isBurning` from
  `../simulation.js`. Cover, on both a plain player-shaped object and an
  enemy-shaped object: (a) slow then burn → burning only; (b) burn then slow →
  slowed only; (c) assert never both true simultaneously after either order.

## Verification: code
