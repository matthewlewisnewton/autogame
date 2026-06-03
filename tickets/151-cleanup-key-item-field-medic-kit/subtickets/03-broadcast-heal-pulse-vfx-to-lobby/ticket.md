# Broadcast Field Medic Kit heal pulse VFX to all lobby clients

`keyItemUsed` is emitted only to the caster, so teammates never run `triggerHealPulseVFX`. Broadcast a lightweight lobby event (mirroring `cardUsed`) so every connected client shows the green ring at the caster's world position, without duplicating the pulse on the using client.

## Acceptance Criteria

- When any player successfully uses `field_medic_kit` in a multiplayer run, **every** connected client in that lobby receives an event that triggers `triggerHealPulseVFX` at the caster's `(x, z)` position.
- The using client sees **exactly one** pulse (no duplicate from both `keyItemUsed` and the broadcast handler).
- Non-caster clients receive the broadcast and show the pulse even though they do not receive `keyItemUsed`.
- The broadcast payload includes `healRadius` from the server def (or equivalent) so allies use the same radius as sub-ticket 02.
- Server-side heal logic, cooldown, and `stateUpdate` behavior are unchanged.

## Technical Specs

- **File**: `game/server/index.js` — in the `field_medic_kit` branch of the `useKeyItem` handler (~lines 2826–2850), after applying heals, emit a lobby-wide event such as `keyItemHealPulse` via `io.to(lobby.id).emit(...)` with at least `{ playerId, x, z, healRadius }` (use `casterX`/`casterZ` already captured and `def.healRadius`).
- Keep the existing caster-only `socket.emit('keyItemUsed', …)` response (cooldown ack); do not replace it with a lobby broadcast.
- **File**: `game/client/main.js` — register `s.on('keyItemHealPulse', …)` (or the chosen event name) near other socket handlers (~line 1045 area). Call `triggerHealPulseVFX({ x, y: 0, z }, healRadius)` using payload coordinates and radius.
- **File**: `game/client/main.js` — remove the `field_medic_kit` branch inside the `keyItemUsed` handler that calls `triggerHealPulseVFX` so the broadcast path is the single VFX trigger for all clients (including the caster).
- **File**: `game/server/test/field_medic_kit.test.js` — add a test with two connected players: caster uses the kit; assert the non-caster socket receives the new heal-pulse event with matching position/radius.

## Verification: code
