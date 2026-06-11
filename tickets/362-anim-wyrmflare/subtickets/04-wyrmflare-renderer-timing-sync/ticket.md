# Wyrmflare renderer timing sync (harness-safe)

Implement or confirm `renderDragonsBreath` composes the sub-ticket 01 breath-cone primitive with 315 VFX primitives so the cast reads as an instant forward cone burst plus a lingering breath zone whose lifetime and tick pulses match the server's `dragons_breath` area effect. Wyrmflare has **no** `windUpMs` (instant spell cast) and **no** projectile travel on the server — remove any travel-implying deferral. This replaces the failed sub-ticket 02: the harness requires `pnpm test:quick` to pass, so this ticket must not regress sub-ticket 03's `cardRenderers.test.js` coverage.

## Acceptance Criteria

- `renderDragonsBreath` calls `ctx.spawnDragonsBreathEffect(origin, direction, { color, emissive, range, coneAngle, dotTicks, dotIntervalMs, duration })` where `range = data.radius`, `coneAngle = data.attackConeAngle ?? Math.PI / 3`, `dotTicks = data.dotTicks ?? 4`, `dotIntervalMs = data.dotIntervalMs ?? 500`, and `duration = dotTicks * dotIntervalMs + 250` (mirrors server `expiresAt = now + ticks * intervalMs + 250`).
- **Instant burst (t = 0):** On `CARD_USED` receipt, synchronously spawns a short `spawnAttackEffect` cone flash, `spawnTelegraphRing` at the cone tip (`pointAlong(origin, direction, range)`), `spawnParticleBurst` at `origin` and at the cone tip, and `spawnImpactDecal` at the tip — matching the server's immediate `collectConeHits` resolution (no `scheduleAfter` delay for the initial hit, no `spawnProjectileTrail` travel streak).
- **Per-hit sync:** For each entry in `data.hits`, spawn an immediate fire burst at the struck enemy's mesh position (`ctx.enemyMeshes()` lookup, y ≈ 0.6) via `spawnHitSpark` and/or `spawnParticleBurst`.
- **DoT tick pulses:** For `tick = 1 … dotTicks`, schedule `ctx.scheduleAfter(dotIntervalMs * tick, …)` to spawn a cone-aligned pulse (`spawnParticleBurst` along the breath axis and/or a compact `spawnTelegraphRing` at `range * 0.65` from `origin`) so visual ticks align with server `updateAreaEffects` intervals (first tick at 500 ms, last at 2000 ms with defaults).
- `CARD_DEFS.dragons_breath` has no positive `windUpMs` — no 307 charge telegraph for this card.
- All optional ctx helpers are guarded (`if (ctx.spawnTelegraphRing)` etc.); `dragons_breath: renderDragonsBreath` registration is unchanged.
- `pnpm test:quick` passes with all existing `dragons_breath` cases in `game/client/test/cardRenderers.test.js` green (sub-ticket 03 coverage must not regress).
- Depends on sub-tickets 01 (`spawnDragonsBreathEffect` primitive + ctx wiring) and 03 (test harness); touch only `cardRenderers.js` unless a minimal test fix is required to unblock a genuine renderer bug.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Implement or verify `renderDragonsBreath` (~L687–761):
    1. Guard on `data.radius === undefined` (keep existing early return).
    2. Resolve `origin`, `direction`, `color`/`emissive` from `getAccentHex(data.cardId)` with fire fallbacks (`0xfb923c` / `0xff3b00`).
    3. Compute `dotTicks`, `dotIntervalMs`, `duration`, `coneAngle`; call `ctx.spawnDragonsBreathEffect(origin, direction, { color, emissive, range: data.radius, coneAngle, dotTicks, dotIntervalMs, duration })`.
    4. Immediate cast flourish: short `spawnAttackEffect` cone, `spawnParticleBurst` at `origin` and cone tip, `spawnImpactDecal` at tip, optional `spawnTelegraphRing` at tip.
    5. Loop `data.hits` for per-enemy ignite bursts (immediate).
    6. Loop `tick = 1 … dotTicks` with `ctx.scheduleAfter(dotIntervalMs * tick, pulseFn)`.
    7. Ensure `spawnProjectileTrail` is **not** used (server has no travel phase).
  - Update the ctx primitive comment block (~L21) to document `spawnDragonsBreathEffect(origin, direction, style?)`.
- **Server reference** (read-only): `cardEffects.js` `dragons_breath` branch emits `CARD_USED` with `{ origin, direction, radius, hits, dotTicks: 4, specialEffect: 'fire_dot' }` and calls `spawnDragonsBreathEffect` server-side for the ticking cone area effect (`dotIntervalMs: 500`, `attackRange: 7`, `attackConeAngle: Math.PI / 3` in `progression.js`). No `windUpMs`, no projectile travel.
- Do **not** modify `renderer.js` primitive internals (owned by sub-ticket 01), server code, or weaken sub-ticket 03 test assertions.

## Verification: code
