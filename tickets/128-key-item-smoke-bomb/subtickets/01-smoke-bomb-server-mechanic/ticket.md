# Smoke Bomb — Server Cast + Concealment Mechanic

Implement the `smoke_bomb` key item server-side. `useKeyItem` spawns a short-lived
smoke zone fixed at the caster's position; while any player stands inside an active
smoke zone, enemies cannot target them (targeting is paused/cleared — the
"temporarily invisible" rule). Re-tune the def to the ticket's cooldown/duration.

## Design choices (documented)

- **Zone position:** stays **fixed at the cast point** (stored as `smokeBombX/Z`),
  matching the existing `barrier_dome` pattern. The player may walk out of it.
- **Effect rule:** **targeting cleared while in zone.** Any living player standing
  inside an active smoke zone (caster OR ally — same co-op behaviour as
  `barrier_dome`) is skipped by enemy target acquisition, and any enemy currently
  winding up against such a player cancels the wind-up. A player who leaves the
  zone (or after the zone expires) becomes targetable again.

## Acceptance Criteria

- `KEY_ITEM_DEFS.smoke_bomb` in `progression.js` has `cooldownMs: 8000`,
  `durationMs: 2000`, and a numeric `radius` (e.g. `4`); `type` stays `'stealth'`.
- `smoke_bomb` is removed from the `not_implemented` allowlist in `index.js`; the
  `useKeyItem` handler has a `smoke_bomb` branch.
- Casting `smoke_bomb` sets `player.smokeBombUntil = now + durationMs`,
  `player.smokeBombRadius`, `player.smokeBombX = player.x`,
  `player.smokeBombZ = player.z`, sets `keyItemCooldownUntil = now + cooldownMs`,
  marks `persistenceDirty`, and emits `keyItemUsed { ok: true, keyItemId: 'smoke_bomb',
  smokeBombUntil, cooldownUntil }` plus a `stateUpdate` broadcast.
- An immediate re-cast while on cooldown returns `{ ok: false, reason: 'on_cooldown',
  remainingMs }` and does NOT refresh the smoke window.
- In `simulation.js`, enemy target acquisition skips any player who is inside an
  active smoke zone (that player is never chosen as `nearestTarget`).
- An enemy mid-wind-up against a player who becomes concealed cancels the wind-up
  (returns to chasing) instead of dealing damage.
- Once `smokeBombUntil` has passed, or once the player leaves the zone radius, the
  player is targetable again (no permanent stealth).
- The existing `key-items.test.js` "non-implemented items returns not_implemented"
  test no longer uses `smoke_bomb` (switch it to a still-unimplemented item such as
  `ground_anchor`), and the smoke_bomb entry remains in the implemented key-item
  list assertions.
- New server tests cover: cast sets state + cooldown, cooldown re-cast rejected,
  a concealed player is not acquired as an enemy target / in-progress wind-up
  cancels, and an expired or exited zone restores targeting.

## Technical Specs

- `game/server/progression.js` — re-tune the `smoke_bomb` entry in `KEY_ITEM_DEFS`
  (`cooldownMs: 8000`, `durationMs: 2000`, add `radius`).
- `game/server/index.js` — `socket.on('useKeyItem', …)` (~line 2706): add
  `smoke_bomb` to the implemented-items allowlist (~line 2738) and add a
  `smoke_bomb` cast branch mirroring the `barrier_dome` branch (~line 2783):
  set `smokeBombUntil/Radius/X/Z`, burn cooldown, `persistenceDirty`, emit
  `keyItemUsed` and `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`.
- `game/server/simulation.js` — `updateEnemies()` (~line 1633): add a helper
  `isPlayerConcealed(player, now)` that returns true if the player is within
  `smokeBombRadius` of any living player's active smoke zone. Use it in the
  player target-acquisition loop (~line 1729) to skip concealed players, and in
  the wind-up revalidation path (`resolveWindupTarget` / the windup branch
  ~line 1660-1680) so a wind-up against a now-concealed player is cancelled.
  Keep `tauntMinion`/minion targeting unaffected.
- `game/server/test/smoke_bomb.test.js` (new) — model on `barrier_dome.test.js`
  and `dodge_roll.test.js` (socket integration for cast/cooldown via
  `helpers.js`; unit-level state setup for the concealment/targeting checks).
- `game/server/test/key-items.test.js` — update the `not_implemented` test
  (~line 261) to use a still-unimplemented key item id.

## Verification: code
