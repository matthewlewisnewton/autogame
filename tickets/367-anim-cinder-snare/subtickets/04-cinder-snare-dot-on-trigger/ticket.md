# Cinder Snare DoT pulses on trap trigger

The placement `cardUsed` path must only show the ground snare being laid (t = 0
burst). The lingering ember/DoT pulse cadence must start when the server
actually triggers the trap and spawns the `inferno_pillar` area effect in
`updateEnchantments()`, not when the card is first played.

## Acceptance Criteria

- `renderCinderSnare` on **placement** (`cardUsed` without `enchantmentTriggered`)
  emits only the t = 0 telegraph ring, ember burst, and scorch decal — **no**
  `ctx.scheduleAfter` calls.
- When `updateEnchantments()` disarms a `cinder_snare` and calls
  `spawnInfernoPillarEffect()`, the server queues a pending trigger payload
  (mirroring `_pendingMinionBreaths` / `_pendingVolatileExplosions`) that is
  flushed to the lobby on the next game-loop tick.
- The flushed trigger payload is a `cardUsed`-shaped event with at least:
  `cardId: 'cinder_snare'`, `enchantmentTriggered: true`, `origin` (trap x/z),
  `radius`, and `playerId` (trap owner).
- On the client, receiving that trigger `cardUsed` runs a **trigger** VFX path:
  inferno pillar at the trap origin plus ember pulse cadence scheduled from
  trigger time at `dotIntervalMs * i` for `i = 1 … dotTicks` (default delays
  **500, 1000, 1500, 2000** ms), reading `dotTicks` / `dotIntervalMs` from
  `CARD_DEFS.cinder_snare`.
- Each scheduled trigger pulse emits at least one cinder primitive
  (`spawnParticleBurst` and/or `spawnTelegraphRing`).
- The existing gold `renderEnchantmentTrigger` ring still fires for
  `enchantmentTriggered` events (do not regress spike-trap-style trigger UX).
- Server test: after an enemy enters a placed `cinder_snare`, the pending
  trigger queue contains one payload with `enchantmentTriggered: true` and the
  trap origin/radius before the game loop drains it.
- Client tests in `game/client/test/cardRenderers.test.js`:
  - Placement `cinder_snare` records **zero** `scheduleAfter` calls.
  - Trigger `cinder_snare` (`enchantmentTriggered: true`) records
    `scheduleAfter` delays `[500, 1000, 1500, 2000]` and invokes VFX primitives
    when callbacks run.
- Existing client + server vitest suites still pass.

## Technical Specs

- `game/server/simulation.js`:
  - In `updateEnchantments()`, when `enc.effect === 'cinder_snare'` triggers,
    after `spawnInfernoPillarEffect(...)`, push to
    `_gameState._pendingCinderSnareTriggers` (new queue) a `cardUsed` payload
    with `cardId: 'cinder_snare'`, `enchantmentTriggered: true`,
    `playerId: enc.ownerId`, `origin: { x: enc.x, z: enc.z }`,
    `radius: enc.radius`, `effect: 'cinder_snare'`.
- `game/server/game-state.js`:
  - Initialize `_pendingCinderSnareTriggers: []` in `createGameState()`.
- `game/server/index.js`:
  - In `runGameLoopTick`, after `updateEnchantments()` / alongside other
    pending queues, drain `_pendingCinderSnareTriggers` by emitting
    `SERVER_TO_CLIENT.CARD_USED` to the lobby room for each entry, then clear
    the array.
- `game/server/progression.js`:
  - Clear `_pendingCinderSnareTriggers` wherever other per-tick pending queues
    are cleared on run reset / abandon (same pattern as `_pendingMinionBreaths`).
- `game/client/cardRenderers.js`:
  - Split `renderCinderSnare` into placement vs trigger branches keyed on
    `data.enchantmentTriggered`.
  - **Placement:** keep sub-ticket 02 primitives; remove the `scheduleAfter`
    loop added in sub-ticket 03.
  - **Trigger:** call `ctx.spawnInfernoPillarEffect(origin, data.radius)` when
    available; schedule ember pulses at `dotIntervalMs * i` for
    `i = 1 … dotTicks` using the shared cinder palette.
- `game/server/test/enchantment.test.js`:
  - Extend the existing `cinder_snare` trigger test to assert the pending queue
    is populated with the expected payload shape.
- `game/client/test/cardRenderers.test.js`:
  - Replace the sub-ticket 03 placement timing test so it asserts **no**
    `scheduleAfter` on placement.
  - Add a trigger-path test with `enchantmentTriggered: true` asserting the
    four-interval cadence and primitive emission.

## Verification: code
