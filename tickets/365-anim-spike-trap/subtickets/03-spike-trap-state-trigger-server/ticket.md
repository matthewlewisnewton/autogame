# Spike Trap — expose armed traps in state + emit trigger event

The client currently has NO data about active ground enchantments: `buildWorldSnapshot`
does not include `_gameState.enchantments`, and nothing is emitted when a trap fires.
As a result `spike_trap` is invisible while it persists server-side for `ttlMs: 30000`
and its proximity hit has no synced feedback. Add the minimal server plumbing so the
client can render the lingering armed trap and react to its trigger. Client rendering
itself is sub-ticket 04.

## Acceptance Criteria

- `buildWorldSnapshot` (`game/server/progression.js`) includes an `enchantments`
  array in the snapshot returned to clients. The array contains the currently
  armed GROUND enchantments (e.g. `spike_trap`, `cinder_snare`) with at least the
  fields the client needs to draw/track them: `id`, `effect`, `x`, `z`, `radius`,
  `expiresAt`, and `armed`. Non-armed/self enchantments are not included.
- The snapshot field is present on BOTH the hot snapshot (`hotStateSnapshot`, the
  per-tick `STATE_UPDATE` broadcast) and the full `stateSnapshot` — i.e. it flows
  through `buildWorldSnapshot` so both paths get it.
- A new server→client event `SPIKE_TRAP_TRIGGERED` exists in
  `game/shared/events.json` under `serverToClient` (and is therefore exported via
  `SERVER_TO_CLIENT` in `events.js`). It is distinct from `VOLATILE_EXPLOSION`.
- When a `spike_trap` enchantment fires (the proximity branch in
  `updateEnchantments` that calls `damageEnemy` and sets `enc.armed = false`),
  the server records a pending trigger record `{ x, z, radius }` on a state-bound
  pending array (e.g. `_gameState._pendingSpikeTrapTriggers`), mirroring the
  existing `_pendingVolatileExplosions` pattern. `cinder_snare` triggers do NOT
  push to this array (they keep their existing inferno-pillar behavior).
- The game loop flushes that pending array each tick: for each record it emits
  `SERVER_TO_CLIENT.SPIKE_TRAP_TRIGGERED` to the lobby and then clears the array,
  mirroring the `_pendingVolatileExplosions` flush block in `game/server/index.js`.
- No gameplay/balance change: trap arming, damage, `ttlMs` expiry, and the
  existing `enchantments` filtering logic are unchanged; this only ADDS a snapshot
  field, an event constant, and a pending-event emission.
- The full server + client vitest suites still pass, and server tests are
  added/extended to assert (a) an armed `spike_trap` appears in the world snapshot
  with the expected fields, and (b) when an enemy enters a `spike_trap`'s radius,
  `updateEnchantments` queues exactly one `_pendingSpikeTrapTriggers` record with
  the trap's `x`/`z`/`radius`.

## Technical Specs

- `game/shared/events.json` — add `"SPIKE_TRAP_TRIGGERED": "spikeTrapTriggered"`
  to the `serverToClient` map (keep alphabetical ordering near `SHIELD_BREAK`).
  `events.js` re-exports automatically; no change needed there.
- `game/server/progression.js` — in `buildWorldSnapshot` (~L3031) add an
  `enchantments` key. Project `_gameState.enchantments` down to armed ground
  entries, e.g.
  `enchantments: (_gameState.enchantments || []).filter((e) => e.armed && e.target === 'ground').map((e) => ({ id: e.id, effect: e.effect, x: e.x, z: e.z, radius: e.radius, expiresAt: e.expiresAt, armed: e.armed }))`.
- `game/server/simulation.js` — in `updateEnchantments` (~L2189), in the
  `spike_trap` (else) branch that sets `enc.armed = false` (~L2207), push
  `{ x: enc.x, z: enc.z, radius: enc.radius }` onto
  `_gameState._pendingSpikeTrapTriggers` (initialize the array if missing, like
  `_pendingVolatileExplosions` in `spawnVolatileExplosion`, ~L1854). Do NOT push
  for the `cinder_snare` branch.
- `game/server/index.js` — in the per-tick pending-event flush region (~L1409,
  next to the `_pendingVolatileExplosions` block) add a block that, when
  `state._pendingSpikeTrapTriggers?.length`, emits
  `io.to(lobby.id).emit(SERVER_TO_CLIENT.SPIKE_TRAP_TRIGGERED, record)` for each
  record and then clears the array (`state._pendingSpikeTrapTriggers.length = 0`).
- `game/server/test/` — extend the relevant simulation/enchantment server test
  (or add a colocated one) for the snapshot field and the pending-trigger queue.
- Do NOT add client rendering here, and do NOT modify `cinder_snare` behavior,
  the spike VFX primitive (sub-ticket 01), or `renderSpikeTrap` (sub-ticket 02).

## Verification: code
