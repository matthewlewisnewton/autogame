# Smoke Bomb — Cast & Zone State

Re-tune the `smoke_bomb` key item definition to match the ticket (2s fog zone,
~8s cooldown) and implement its `useKeyItem` cast handler so casting creates an
active smoke zone (`smokeBombUntil` + radius + center) fixed at the player's cast
position and broadcasts it. The targeting/detection effect is handled in
sub-ticket 02 and the client VFX in sub-ticket 03; this sub-ticket only
establishes the def, the cast, and the zone state.

**Design choices (documented here, enforced by later sub-tickets):**
- The zone is **fixed at the cast point** (does NOT follow the player), mirroring
  `barrier_dome`'s `barrierDomeX`/`barrierDomeZ` pattern.
- The combat rule (implemented in 02) is **"enemies lose detection"**: enemies
  cannot acquire a player standing inside an active zone.

## Acceptance Criteria

- `KEY_ITEM_DEFS.smoke_bomb` in `game/server/progression.js` is re-tuned to:
  `cooldownMs: 8000`, `durationMs: 2000`, `radius: 4` (keep `id`, `name`,
  `type`, and give it a description mentioning fog/smoke that makes enemies lose
  track of the player). No stray legacy values remain (old
  `cooldownMs: 18000` / `description: 'Become temporarily invisible'` are gone).
- `smoke_bomb` is removed from the `not_implemented` rejection list in the
  `useKeyItem` handler in `game/server/index.js` and gets its own branch.
- Using `smoke_bomb` (off cooldown, in a dungeon) sets on the caster:
  `smokeBombUntil = now + durationMs`, `smokeBombRadius = radius`,
  `smokeBombX = player.x`, `smokeBombZ = player.z`, and
  `keyItemCooldownUntil = now + cooldownMs`.
- The handler emits `keyItemUsed` with `{ ok: true, keyItemId: 'smoke_bomb',
  smokeBombUntil, cooldownUntil }` to the caster and broadcasts a `stateUpdate`
  to the lobby.
- Cooldown is enforced: a second immediate use returns
  `{ ok: false, reason: 'on_cooldown', remainingMs }` and does not refresh the
  zone.
- `stateSnapshot()` in `game/server/progression.js` exposes per-player
  `smokeBombUntil`, `smokeBombRadius`, `smokeBombX`, and `smokeBombZ` so
  allies/clients can see and render an active zone; the fields are 0/absent when
  no zone is active.
- `smokeBombUntil`/`smokeBombRadius`/`smokeBombX`/`smokeBombZ` are NOT added to
  `extractPersistentData` (they stay transient, like `barrierDomeUntil` and
  `invulnerableUntil`).
- A server test (e.g. `game/server/test/smoke_bomb.test.js`) covers: def values;
  cast sets `smokeBombUntil`/radius/center and cooldown; cooldown blocks an
  immediate re-cast.

## Technical Specs

- `game/server/progression.js`:
  - Update the `smoke_bomb` entry in `KEY_ITEM_DEFS` (around line 626) to the
    re-tuned values above.
  - In `stateSnapshot()` per-player block (around line 3022, next to
    `barrierDomeUntil`/`barrierDomeRadius`), add
    `smokeBombUntil: p.smokeBombUntil || 0`,
    `smokeBombRadius: p.smokeBombRadius || 0`,
    `smokeBombX: p.smokeBombX || 0`, and `smokeBombZ: p.smokeBombZ || 0`.
- `game/server/index.js`:
  - In the `useKeyItem` handler (around line 2561): add `'smoke_bomb'` to the
    implemented set (the condition near line 2591) and add a dedicated
    `if (keyItemId === 'smoke_bomb') { … }` branch mirroring the structure of
    the `barrier_dome` branch (set transient state, set cooldown, emit
    `keyItemUsed`, broadcast `stateUpdate`, `return`). Read `radius`/`durationMs`
    from `def` with sensible fallbacks (`4` / `2000`).
- Do NOT implement the detection/targeting logic here — that is sub-ticket 02 —
  and do NOT add client rendering — that is sub-ticket 03.

## Verification: code
