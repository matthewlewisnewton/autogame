# Battery Automaton — charge-pulse timing sync in minion sync

Wire the periodic charge-restore pulse into client VFX so each server-side `restoreHandCharges` tick from a Battery Automaton minion produces a visible electric discharge synced to `lastChargePulseAt` advancing every `chargePulseIntervalMs` (6000 ms). Depends on sub-tickets 01 (`spawnBatteryChargePulseEffect`) and 02 (`MINION_VISUAL` preset).

## Background (verified, do not re-derive)

- Server `simulation.js` `updateMinions()` (~L3390–3402): when `now - lastChargePulseAt >= chargePulseIntervalMs` (default 6000), calls `restoreHandCharges(owner, chargeRestore || 1)` and advances `lastChargePulseAt` by `pulses * interval`.
- `stateSnapshot()` serializes minions verbatim, so `lastChargePulseAt` and `chargePulseIntervalMs` are available on the client game-state snapshot.
- There is **no** `CARD_USED` event per pulse — the client must detect pulse firings by watching `lastChargePulseAt` increase between sync frames.
- Battery Automaton minions do not attack; the charge pulse is the only ongoing combat-adjacent visual besides the summon.

## Acceptance Criteria

- `syncMinionMeshes` (in `minionSync.js`) tracks the previous `lastChargePulseAt` per `battery_automaton` minion id.
- When `minion.lastChargePulseAt` advances (strictly increases) for a `battery_automaton`, the sync loop calls `spawnBatteryChargePulseEffect({ x: minion.x, z: minion.z }, { duration: <brief ms> })` exactly once per server pulse (no duplicate VFX on unchanged snapshots).
- Pulse VFX does **not** fire on the initial spawn frame when `lastChargePulseAt` is first set equal to `createdAt` / deploy time — only on subsequent advances (i.e. when a charge is actually restored).
- The brief pulse effect duration (~600–800 ms) is independent of the 6000 ms interval; the **trigger** is tied to `lastChargePulseAt` advancing, not a client-side timer that could drift from server ticks.
- While a battery minion is alive, its mesh retains the amber/cyan `MINION_VISUAL` preset from sub-ticket 02 (no regression to generic green).
- No server changes; no changes to other minion types' sync behavior (`null_crawler` windup telegraph, escort HP bar, etc.).
- `pnpm test:quick` passes; sub-ticket 04 owns dedicated test coverage.

## Technical Specs

- **`game/client/renderer/minionSync.js`**:
  - Import `spawnBatteryChargePulseEffect` from `../renderer.js`.
  - Add a module-level `previousBatteryChargePulseAt` map keyed by minion id.
  - In the per-minion loop inside `syncMinionMeshes`, for `minion.type === 'battery_automaton'`:
    - Compare `minion.lastChargePulseAt` to `previousBatteryChargePulseAt[minion.id]`.
    - When the value increases, call `spawnBatteryChargePulseEffect` at the minion's current `{ x, z }`.
    - Update the tracked value; delete entries when the minion leaves the snapshot.
  - Clean up `previousBatteryChargePulseAt` entries in the same disposal pass that removes departed minion meshes.
- **`game/client/renderer.js`**: read-only consumption of `spawnBatteryChargePulseEffect` export from sub-ticket 01; do not alter primitive internals.
- **Server reference** (read-only): `server.test.js` "Battery Automaton restores charges periodically" exercises the 6000 ms pulse. Do not modify server code.
- Do **not** add or update tests in this sub-ticket (owned by sub-ticket 04).

## Verification: code
