# Aegis Sentinel — renderer, registration, minion visual & timing sync

Give `aegis_sentinel` a dedicated card-specific renderer and thematic `MINION_VISUAL` preset so casting Aegis Sentinel reads unmistakably as a green shield taunt wall — not the generic creature default or the indigo Astral Guardian spell. Compose sub-ticket 01's primitives with the shared `spawnMinionSummonInEffect` flourish, timed to the instant server resolution and the minion summon-in window. Depends on sub-ticket 01.

## Background (verified, do not re-derive)

- Server `applyAstralShieldCast` (`cardEffects.js`) resolves **instantly** for creatures (no `windUpMs` on `aegis_sentinel`): one `CARD_USED` emit with `{ origin, radius: SUMMON_RADIUS, hits: [], shieldGranted: 30, minionId, specialEffect: 'astral_shield' }`.
- On cast: player gains 30 shield HP (~8 s), zero burst damage, and a taunt minion (`type: 'aegis_sentinel'`, 160 HP, `attackDamage: 0`) spawns at the cast origin.
- Client `minionSync.js` scales new minion meshes in over `MINION_SUMMON_IN_MS` (750 ms). Summon VFX must fire **synchronously** on `CARD_USED` receipt (no projectile travel, no wind-up `scheduleAfter` deferral on the main cast path).
- Today `resolveRenderers('aegis_sentinel')` falls through to the type default `renderCreatureSummon`.
- `astral_guardian` already owns `renderAstralGuardian` with indigo palette (`0x818cf8` / `0x6366f1`); Aegis Sentinel must use the green shield palette (`#4ade80`) and read as defensive/taunt, not offensive radial.

## Acceptance Criteria

- A new card-specific renderer function (e.g. `renderAegisSentinel`) exists in `game/client/cardRenderers.js` and is registered in `CARD_RENDERERS` under the Creatures section keyed by `aegis_sentinel`.
- `resolveRenderers('aegis_sentinel')` returns exactly one renderer, and it is NOT the generic `creature` type-default renderer (`renderCreatureSummon`) or `renderAstralGuardian`.
- On cast with `data.shieldGranted` present, the renderer calls `ctx.spawnAegisSentinelShieldFlourish(originOf(data), aegisStyle)` synchronously at cast time.
- On summon (`data.minionId` present), the renderer calls:
  - `ctx.spawnAegisSentinelDeployEffect(originOf(data), aegisStyle)` for the shield-wall deploy flourish.
  - `ctx.spawnMinionSummonInEffect(originOf(data), aegisStyle)` with green/gold palette distinct from the generic green creature default and from `astral_guardian`.
- All flourish durations passed to primitives use `MINION_SUMMON_IN_MS` (750 ms) so VFX lifetime matches the minion mesh scale-in.
- `MINION_VISUAL.aegis_sentinel` is defined in `renderer.js` with a wide box or compact shield-wall silhouette (green body, gold/green emissive) so the persistent minion mesh matches the card theme — not the generic green cylinder fallback.
- Aegis Sentinel has **no** `windUpMs` — cast VFX fires synchronously on `CARD_USED` with no `scheduleAfter` delay on the main shield/deploy path.
- Every `ctx.*` call is guarded so optional primitives never throw.
- `main.js` `cardRenderCtx` exposes `spawnAegisSentinelShieldFlourish` and `spawnAegisSentinelDeployEffect` from `renderer.js`.
- No perf regression; diff stays within the files listed below.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Add `AEGIS_SENTINEL_COLOR` / `AEGIS_SENTINEL_EMISSIVE` constants and `renderAegisSentinel(data, ctx)`.
  - Early-return gracefully when required ctx helpers are absent; compose shield flourish when `data.shieldGranted`, deploy + `spawnMinionSummonInEffect` when `data.minionId`.
  - Register `aegis_sentinel: renderAegisSentinel` in `CARD_RENDERERS` under `// Creatures`.
  - Update the ctx interface comment block to document the new primitives.
- **`game/client/renderer.js`**: add `MINION_VISUAL.aegis_sentinel` entry (wide box shield-wall preset with green/gold palette).
- **`game/client/main.js`**: import and wire both primitives on `cardRenderCtx`.
- **Server reference** (read-only): `applyAstralShieldCast` in `cardEffects.js`; `aegis_sentinel.test.js` for payload shape. Do not modify server code.
- Do **not** modify primitive internals (owned by sub-ticket 01) or add test assertions (owned by sub-ticket 03).

## Verification: code
