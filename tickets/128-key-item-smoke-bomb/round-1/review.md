# Senior review: 128 — Key Item: Smoke Bomb

**Ticket:** Smoke Veil (`smoke_bomb`) — 2s fog zone at cast; enemies lose targeting or accuracy while inside.  
**Baseline:** `9abbd7e6c30aade3dab48fc2556a786884f50acb`  
**Commits:** `6248967` (cast/zone), `c4dca66` (targeting suppression), `bd606fa` (client VFX)

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` / `failure_kind` | Empty / absent |
| `console.log` fatal / `pageerror` | None (only Vite connect, benign 409 on auth resource, `[initScene]` logs) |
| `harness_failure` | Absent |

The captured two-player lobby → gameplay run reached `phase: "playing"`, canvas initialized, enemies present, no browser exceptions. Harness did not exercise `useKeyItem('smoke_bomb')` in the fallback capture plan (movement-only); gameplay proof for the key item is from unit tests and code review, which is consistent with sub-ticket verification mode (`Verification: code`).

## Acceptance criteria

### Cooldown ~8s

`KEY_ITEM_DEFS.smoke_bomb` in `game/server/progression.js` sets `cooldownMs: 8000`. The `useKeyItem` branch sets `player.keyItemCooldownUntil = now + (def.cooldownMs || 8000)` and rejects immediate re-use with `on_cooldown`. `smoke_bomb.test.js` asserts cooldown timing and non-refresh on double cast.

### Zone follows player or stays fixed (documented choice)

**Choice: fixed at cast point.** `game/server/index.js` documents that `smokeBombX` / `smokeBombZ` are stamped at cast time and do not follow movement. `smoke_bomb.test.js` moves the player after cast and asserts anchor coordinates unchanged. Gameplay uses `isInSmokeZone(x, z)` against that anchor, so protection is positional (stand in the cloud), not “attached to the caster.”

### Client smoke VFX

`triggerSmokeBombVFX` in `game/client/renderer.js` adds a flattened translucent grey sphere, fades over ~2s, disposes geometry/material. `game/client/main.js` calls it on `keyItemUsed` when `data.ok && data.keyItemId === 'smoke_bomb'`, matching the `field_medic_kit` caster-position pattern. Early-return if `scene` is missing. Sub-ticket 03 criteria satisfied.

### Tests: miss rate up or targeting cleared in zone

**Rule chosen: targeting cleared** (documented in `simulation.js` and sub-ticket 02). `isInSmokeZone` is exported and used in enemy AI: players inside any active zone are skipped in nearest-target selection; mid-windup strikes against a smoked player cancel without damage. `smoke_bomb_targeting.test.js` covers acquisition suppression, expiry, leaving radius, co-op protection, windup cancel, and a non-smoked control hit. All enemy types in `ENEMY_DEFS` share this windup path (no separate enemy projectile bypass). Socket integration in `smoke_bomb.test.js` covers cast state and cooldown.

### Top-level goal (`useKeyItem` spawns 2s zone; enemy debuff)

Implemented end-to-end: cast → transient zone state → server AI suppression → caster VFX on success. `smoke_bomb` is on the implemented-key-item allow-list; `key-items.test.js` still lists it among unlocked defs.

## Design & foundation

- **Server authority:** Zone and suppression live on the server; clients do not simulate stealth.
- **design.md / requirements.md:** No regression to connection, movement, or core loop; smoke bomb is additive key-item combat.
- **Dependencies (118, 121):** Uses existing `useKeyItem` / equip / cooldown infrastructure; no new persistence schema beyond transient player fields and `persistenceDirty` on cast (same pattern as other key items).

## Debug scenarios

No `?debugScenario=` shortcut was added for smoke bomb. Normal path: equip `smoke_bomb` → `useKeyItem` in dungeon — unchanged.

## Code quality

- Focused diff across progression def, `index.js` handler, `simulation.js` helper + AI hooks, client VFX, and dedicated tests.
- Comments clearly state fixed-zone vs follow-player and suppression semantics.
- **Unit tests:** `pnpm test:quick` reported 1428 passed including `smoke_bomb.test.js` (4) and `smoke_bomb_targeting.test.js` (10). Round-1 `coverage.log` shows those files executed under vitest.

## Integration notes (non-blocking)

- Capture screenshots show generic movement combat, not smoke-bomb usage; acceptable given code-verified VFX sub-ticket.
- `keyItemUsed` is emitted only to the caster (same as other key-item VFX); allies do not see the fog mesh unless extended later — gameplay still replicates via server sim.

## Remaining gaps

None blocking. All acceptance criteria are met with documented design choices and automated tests; the captured run is healthy.

VERDICT: PASS
