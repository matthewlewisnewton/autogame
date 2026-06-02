# Smoke Bomb — cast & spawn fog zone

Wire `useKeyItem('smoke_bomb')` to spawn a short-lived smoke zone **fixed at the
caster's cast position** (it does NOT follow the player), set the cooldown to
~8s, and add `smoke_bomb` to the implemented-key-item allow-list. The gameplay
effect (enemy targeting suppression) is implemented in sub-ticket 02; this
sub-ticket only establishes the cast, the transient zone state, and cooldown.

## Acceptance Criteria

- `smoke_bomb` cooldown is ~8s (`cooldownMs: 8000`), not `18000`.
- `smoke_bomb` zone duration is ~2s (`durationMs: 2000`), and the def carries a
  `radius` (e.g. `radius: 4`).
- `useKeyItem` with `keyItemId: 'smoke_bomb'` is no longer rejected as
  `not_implemented`.
- Using `smoke_bomb` records a transient zone **fixed at the caster's position at
  cast time**: it sets `player.smokeBombUntil = now + durationMs`,
  `player.smokeBombX = player.x`, `player.smokeBombZ = player.z`, and
  `player.smokeBombRadius = radius`. The zone position does NOT update as the
  player subsequently moves (document this "fixed at cast point" choice in a
  code comment).
- Using `smoke_bomb` burns the ~8s cooldown (`player.keyItemCooldownUntil =
  now + cooldownMs`), marks `player.persistenceDirty = true`, emits
  `keyItemUsed { ok: true, keyItemId, smokeBombUntil, cooldownUntil }`, and
  broadcasts `stateUpdate`.
- On-cooldown reuse is rejected with `keyItemUsed { ok: false, reason: 'on_cooldown' }`
  (existing shared cooldown gate is sufficient).
- Tests in `game/server/test/` cover: using `smoke_bomb` sets `smokeBombUntil`
  to a future timestamp, stamps `smokeBombX`/`smokeBombZ` at the cast position,
  and sets `keyItemCooldownUntil` to ~8s out; an immediate second use is
  rejected `on_cooldown`.

## Technical Specs

- `game/server/progression.js`: in the `smoke_bomb` def (~line 626), change
  `cooldownMs` from `18000` to `8000`, change `durationMs` from `3000` to `2000`,
  and add `radius: 4`.
- `game/server/index.js`:
  - Add `'smoke_bomb'` to the implemented-key-item allow-list (~line 2593) so it
    is not rejected as `not_implemented`.
  - Add a `if (keyItemId === 'smoke_bomb') { ... }` branch in the `useKeyItem`
    handler (alongside the `barrier_dome` branch, ~line 2638). Read
    `durationMs = def.durationMs != null ? def.durationMs : 2000` and
    `radius = def.radius != null ? def.radius : 4`; set `player.smokeBombUntil`,
    `player.smokeBombX = player.x`, `player.smokeBombZ = player.z`,
    `player.smokeBombRadius = radius`, set `player.keyItemCooldownUntil =
    now + (def.cooldownMs || 8000)`, mark `player.persistenceDirty = true`, emit
    `keyItemUsed { ok: true, keyItemId, smokeBombUntil: player.smokeBombUntil,
    cooldownUntil: player.keyItemCooldownUntil }`, and `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`.

## Verification: code
