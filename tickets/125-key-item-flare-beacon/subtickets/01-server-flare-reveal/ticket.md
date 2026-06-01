# 01 — Server: Flare Beacon reveal logic

Implement the server-side handler for `flare_beacon` key item: find all living enemies within a configurable radius of the player, set a `revealedUntil` timestamp on each, and enforce a cooldown.

## Acceptance Criteria

- `flare_beacon` is added to the implemented gate in `useKeyItem` (alongside `dodge_roll`, `summon_recall`, `field_medic_kit`, `guard_block`)
- Calling `useKeyItem` with `flare_beacon` sets `revealedUntil = Date.now() + revealDurationMs` on every living enemy within `revealRadius` (default 25m) of the player
- Enemies outside the radius are **not** modified
- The `KEY_ITEM_DEFS` entry for `flare_beacon` includes `revealRadius: 25` and `revealDurationMs: 3000`, and `cooldownMs: 10000`
- Cooldown is enforced: a second use within 10s returns `on_cooldown` with `remainingMs`
- `revealedUntil` is included in the `stateSnapshot` (happens automatically since enemies are sent as-is)
- Expired `revealedUntil` is cleaned up each game tick (enemies whose `revealedUntil < Date.now()` get the field deleted or zeroed)

## Technical Specs

**Files to modify:**

- `game/server/progression.js`
  - Update `KEY_ITEM_DEFS.flare_beacon`: set `cooldownMs: 10000`, add `revealRadius: 25`, `revealDurationMs: 3000`, improve description to "Reveal all enemies in a large radius on your HUD for a few seconds"
- `game/server/index.js`
  - Add `'flare_beacon'` to the implemented gate check (line ~2498)
  - Add handler block (after `guard_block`, before the cooldown/set-dirty block):
    - Compute `now = Date.now()`
    - Set `player.keyItemCooldownUntil = now + def.cooldownMs`
    - Iterate `_gameState.enemies`; for each living enemy, compute `dist = Math.hypot(enemy.x - player.x, enemy.z - player.z)`
    - If `dist <= revealRadius`, set `enemy.revealedUntil = now + revealDurationMs`
    - Emit `keyItemUsed` with `{ ok: true, keyItemId: 'flare_beacon', revealed: count }`
- `game/server/simulation.js`
  - In the per-tick enemy update loop (near `removeDeadEnemies` or the main tick function), add cleanup: iterate enemies and delete `enemy.revealedUntil` (or set to 0) when `Date.now() >= enemy.revealedUntil`

## Verification: code
