# Cinder Snare placement + DoT-on-trigger wiring

Wire the `cinder_snare` enchantment so it places a ground trap via
`spawnGroundEnchantment` and, when an enemy enters its radius, spawns a
lingering inferno-pillar-style DoT area (via `spawnInfernoPillarEffect`)
instead of dealing one burst of damage like `spike_trap`. Depends on
sub-ticket 01 (card data must exist).

## Acceptance Criteria

- Using a `cinder_snare` card in the dungeon places a ground enchantment:
  the `cinder_snare` effect routes through the same placement path as
  `spike_trap` in `cardEffects.js` (ground-enchantment count cap check,
  `spawnGroundEnchantment`, `cardUsed` emit).
- The placed enchantment carries its DoT parameters (`damagePerTick`,
  `dotTicks`, `dotIntervalMs`) so the trigger can build the DoT area.
- When a living enemy enters the trap radius, `updateEnchantments` triggers
  the `cinder_snare` and, instead of one-shot `damageEnemy`, calls
  `spawnInfernoPillarEffect` at the trap position (`enc.x`, `enc.z`), pushing
  an `inferno_pillar` area effect into `gameState.areaEffects` with
  `damagePerTick ~8` and `dotTicks 4` over `radius ~2.5`.
- The trap disarms after triggering (removed from `gameState.enchantments`),
  and is NOT consumed by the proximity check until an enemy actually enters.
- Advancing the area-effect tick loop (`updateAreaEffects` / `updateMinions`)
  damages the enemy repeatedly over the DoT ticks (sustained, not a single
  burst).
- A vitest test in `game/server/test/enchantment.test.js` covers the
  DoT-on-trigger behavior: place `cinder_snare`, move an enemy into radius,
  call `updateEnchantments`, assert an `inferno_pillar` area effect was spawned
  at the trap position and the enchantment disarmed, then advance the tick loop
  and assert the enemy loses HP over multiple ticks.
- Full vitest suite is green.

## Technical Specs

- `game/server/cardEffects.js` (enchantment branch ~lines 824-855): extend the
  existing `spike_trap` handling so `cinder_snare` shares the same path —
  include it in the `MAX_GROUND_ENCHANTMENTS_PER_PLAYER` count check
  (`countGroundEnchantmentsForPlayer`) and the `spawnGroundEnchantment` +
  `stateUpdate`/`cardUsed` emit block. Prefer a condition like
  `cardDef.effect === 'spike_trap' || cardDef.effect === 'cinder_snare'`.
- `game/server/simulation.js`:
  - `spawnGroundEnchantment` (~lines 1453-1469): also persist the DoT fields
    onto the enchantment object when present on the cardDef —
    `damagePerTick: cardDef.damagePerTick`, `dotTicks: cardDef.dotTicks`,
    `dotIntervalMs: cardDef.dotIntervalMs`. (Existing `spike_trap` callers are
    unaffected since those fields are undefined for it.)
  - `updateEnchantments` (~lines 1589-1625): stop early-continuing on
    non-`spike_trap` effects — also process `cinder_snare`. On an enemy entering
    radius: for `spike_trap` keep the current one-shot `damageEnemy` behavior;
    for `cinder_snare`, instead build a synthetic cardDef
    `{ damage: enc.damagePerTick, dotTicks: enc.dotTicks, dotIntervalMs: enc.dotIntervalMs, attackRange: enc.radius }`
    and call `spawnInfernoPillarEffect(enc.x, enc.z, syntheticDef, enc.ownerId)`.
    Set `enc.armed = false` so the trap is filtered out afterward. Note
    `spawnInfernoPillarEffect` (simulation.js:1274-1292) reads `cardDef.damage`,
    `cardDef.dotTicks`, `cardDef.dotIntervalMs`, and `cardDef.attackRange`.
- `game/server/test/enchantment.test.js`: add the `cinder_snare` DoT test.
  Mirror the existing `spike_trap triggers` test (lines 27-53) for setup, and
  the `Thermal Column leaves a ticking radial area effect` test in
  `new_card_pack.test.js` (lines 439-452) for advancing the DoT via
  `updateMinions` and asserting repeated HP loss. `updateEnchantments`,
  `spawnGroundEnchantment`, and `CARD_DEFS` are already imported there.

## Verification: code
