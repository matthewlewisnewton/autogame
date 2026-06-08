# Thermal Column renderer polish and server timing sync

Upgrade `renderInfernoPillar` to compose the reworked thermal-column primitive (sub-ticket 01) with 315 VFX primitives so the cast reads as an instant radial eruption plus a lingering burning column whose lifetime and tick pulses match the server's `inferno_pillar` area effect. Thermal Column has **no** `windUpMs` (instant spell cast).

## Acceptance Criteria

- `renderInfernoPillar` calls `ctx.spawnInfernoPillarEffect(origin, data.radius, { color, emissive, dotTicks, dotIntervalMs, duration })` where `dotTicks = data.dotTicks ?? 4`, `dotIntervalMs = data.dotIntervalMs ?? 500`, and `duration = dotTicks * dotIntervalMs + 250` (mirrors server `expiresAt = now + ticks * intervalMs + 250`).
- **Instant eruption (t = 0):** On `CARD_USED` receipt, synchronously spawns `spawnTelegraphRing(origin, data.radius, …)`, `spawnParticleBurst` at `origin`, and `spawnImpactDecal` at `origin` using `getAccentHex('inferno_pillar')` (`0xef4444`) with emissive fallback `0xff3b00` — matching the server's immediate `collectRadialHits` burst (no projectile travel, no `scheduleAfter` delay for the initial hit).
- **Per-hit sync:** For each entry in `data.hits`, spawn an immediate fire burst at the struck enemy's mesh position (`ctx.enemyMeshes()` lookup, y ≈ 0.6) via `spawnHitSpark` and/or `spawnParticleBurst`.
- **DoT tick pulses:** For `tick = 1 … dotTicks`, schedule `ctx.scheduleAfter(dotIntervalMs * tick, …)` to spawn a smaller radial pulse at `origin` (`spawnTelegraphRing` at `data.radius * 0.65` and/or compact `spawnParticleBurst`) so visual ticks align with server `updateAreaEffects` intervals (first tick at 500 ms, last at 2000 ms with defaults).
- `CARD_DEFS.inferno_pillar` has no positive `windUpMs` — no 307 charge telegraph for this card.
- All optional ctx helpers are guarded (`if (ctx.spawnTelegraphRing)` etc.); `inferno_pillar: renderInfernoPillar` registration is unchanged.
- Depends on sub-ticket 01 (reworked `spawnInfernoPillarEffect` accepting the style object).
- Do **not** add or update tests in this sub-ticket (owned by sub-ticket 03).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Rewrite `renderInfernoPillar` (~L717–730):
    1. Guard on `data.radius === undefined` (keep existing early return).
    2. Resolve `origin`, `color`/`emissive` from `getAccentHex(data.cardId)`.
    3. Compute `dotTicks`, `dotIntervalMs`, `duration`; call `ctx.spawnInfernoPillarEffect(origin, data.radius, { color, emissive, dotTicks, dotIntervalMs, duration })`.
    4. Immediate cast flourish: `spawnTelegraphRing`, `spawnParticleBurst`, `spawnImpactDecal` at `origin`.
    5. Loop `data.hits` for per-enemy ignite bursts (immediate).
    6. Loop `tick = 1 … dotTicks` with `ctx.scheduleAfter(dotIntervalMs * tick, pulseFn)`.
  - Update the ctx primitive comment block (~L21) to document the new third-argument `style` object.
- **Server reference** (read-only): `cardEffects.js` `inferno_pillar` branch emits `CARD_USED` with `{ origin, radius, radialBurst: true, hits, dotTicks: 4, specialEffect: 'fire_dot' }` and calls `spawnInfernoPillarEffect` server-side for the ticking area effect (`dotIntervalMs: 500`, `attackRange: 7` in `cardStats.json`). No `windUpMs`, no projectile travel.
- Do **not** modify `renderer.js` primitive internals (owned by sub-ticket 01) or server code.

## Verification: code
