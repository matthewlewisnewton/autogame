# Server: Smoke Veil cast, definition, and state sync

## Description

Implement `useKeyItem` for `smoke_bomb` (**Smoke Veil**): retune `KEY_ITEM_DEFS`, spawn a ~2s zone at the caster’s feet (fixed world position at cast time), apply an ~8s key-item cooldown, and expose veil fields on player snapshots so clients can render the fog. Document the fixed cast-point choice (zone does not follow movement).

## Acceptance Criteria

- `KEY_ITEM_DEFS.smoke_bomb` uses display name **Smoke Veil**, `cooldownMs` ≈ 8000, `durationMs` ≈ 2000, and a `radius` (≈ 4, aligned with client `SMOKE_RADIUS`) with an updated description mentioning concealment at the cast point.
- `useKeyItem` with `keyItemId: 'smoke_bomb'` succeeds in a dungeon run: sets `player.smokeVeilUntil`, `player.smokeVeilX`, `player.smokeVeilZ`, and `player.smokeVeilRadius` from the caster’s position at cast time; sets `player.keyItemCooldownUntil`; emits `keyItemUsed` with `ok: true` and `stateUpdate`.
- `smoke_bomb` is added to the implemented-key-item allowlist in `index.js` (no longer returns `not_implemented`).
- `stateSnapshot()` includes `smokeVeilUntil`, `smokeVeilX`, `smokeVeilZ`, and `smokeVeilRadius` per player (0 / omitted when inactive).
- A short comment in `index.js` or `progression.js` states: **zone center is fixed at cast; it does not track the player afterward.**

## Technical Specs

- **`game/server/progression.js`**: Update `smoke_bomb` entry (`name`, `description`, `cooldownMs`, `durationMs`, `radius`).
- **`game/server/index.js`**: In the `useKeyItem` handler, add a `smoke_bomb` branch (mirror `barrier_dome` pattern): read `def.durationMs` / `def.radius`, snapshot `player.x` / `player.z` into `smokeVeilX` / `smokeVeilZ`, set `smokeVeilUntil = now + durationMs`, apply cooldown, `persistenceDirty`, broadcast `stateUpdate`.
- **`game/server/progression.js`** (`stateSnapshot` player map): Serialize the four `smokeVeil*` fields.
- **`game/server/test/key-items.test.js`**: Replace or extend the `not_implemented` smoke_bomb case to assert successful cast and cooldown (detailed combat tests belong in sub-ticket 04).

## Verification: code
