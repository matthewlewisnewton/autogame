# Barrier Dome — Cast & Dome State

Re-tune the `barrier_dome` key item definition to match the ticket (1s bubble,
3m radius, ~14s cooldown) and implement its `useKeyItem` cast handler so casting
creates an active dome (`barrierDomeUntil` + radius + center) on the caster and
broadcasts it. Actual projectile blocking is handled in sub-ticket 02; this
sub-ticket only establishes the def, the cast, and the dome state.

## Acceptance Criteria

- `KEY_ITEM_DEFS.barrier_dome` in `game/server/progression.js` is re-tuned to:
  `cooldownMs: 14000`, `durationMs: 1000`, `radius: 3` (keep `id`, `name`,
  `type: 'defensive'`, and a description mentioning blocking projectiles). No
  stray `absorbedDamage`/old `radius: 5`/`durationMs: 8000` values remain.
- `barrier_dome` is removed from the `not_implemented` rejection list in the
  `useKeyItem` handler in `game/server/index.js` and gets its own branch.
- Using `barrier_dome` (off cooldown, in a dungeon) sets on the caster:
  `barrierDomeUntil = now + durationMs`, `barrierDomeRadius = radius`,
  `barrierDomeX = player.x`, `barrierDomeZ = player.z`, and
  `keyItemCooldownUntil = now + cooldownMs`.
- The handler emits `keyItemUsed` with `{ ok: true, keyItemId: 'barrier_dome',
  barrierDomeUntil, cooldownUntil }` to the caster and broadcasts a
  `stateUpdate` to the lobby.
- Cooldown is enforced: a second immediate use returns
  `{ ok: false, reason: 'on_cooldown', remainingMs }` and does not refresh the
  dome.
- `stateSnapshot()` in `game/server/progression.js` exposes per-player
  `barrierDomeUntil` (and `barrierDomeRadius`) so allies/clients can see an
  active dome; the field is 0/absent when no dome is active.
- `barrierDomeUntil`/`barrierDomeRadius`/`barrierDomeX`/`barrierDomeZ` are NOT
  added to `extractPersistentData` (they stay transient, like
  `invulnerableUntil`).
- A server test (e.g. `game/server/test/barrier_dome.test.js`) covers: def
  values; cast sets `barrierDomeUntil`/radius/center and cooldown; cooldown
  blocks an immediate re-cast.

## Technical Specs

- `game/server/progression.js`:
  - Update the `barrier_dome` entry in `KEY_ITEM_DEFS` (around line 666) to the
    re-tuned values above.
  - In `stateSnapshot()` per-player block (around line 3020), add
    `barrierDomeUntil: p.barrierDomeUntil || 0` and
    `barrierDomeRadius: p.barrierDomeRadius || 0`.
- `game/server/index.js`:
  - In the `useKeyItem` handler (around line 2559): add `'barrier_dome'` to the
    implemented set (the condition near line 2591) and add a dedicated
    `if (keyItemId === 'barrier_dome') { … }` branch mirroring the structure of
    the `guard_block` branch (set transient state, set cooldown, emit
    `keyItemUsed`, broadcast `stateUpdate`, `return`). Read `radius`/`durationMs`
    from `def` with sensible fallbacks (`3` / `1000`).
- Do NOT implement the damage-blocking logic here — that is sub-ticket 02.

## Verification: code
