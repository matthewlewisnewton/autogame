# Glacial Orb cast, trail, and impact timing sync

Rewrite `renderIceBall` so cast, projectile travel, terminal impact, and per-enemy slow VFX are timed to match server resolution. Glacial Orb has **no** `windUpMs` (instant spell cast); ongoing slow visuals remain driven by broadcast `slowedUntil` — this ticket only covers the cast→travel→impact moment.

## Acceptance Criteria

- `renderIceBall` derives a single `travelMs` from `data.projectileTravelMs ?? 1200` and passes it to `spawnAttackEffect` as `projectileTravelMs` and to `spawnProjectileTrail` as `travelMs`, so the projectile mesh (sub-ticket 01), trail streak, and terminal impact share one duration constant.
- **Cast:** On `CARD_USED`, a brief frost channel flourish spawns at the caster origin (`spawnParticleBurst` and/or a small `spawnTelegraphRing`) using `getAccentHex('ice_ball')` palette (`0x67e8f9` / `0x38bdf8` fallbacks).
- **Terminal impact:** `spawnImpactDecal` and the freeze-crystal `spawnParticleBurst` at max range are deferred via `ctx.scheduleAfter(travelMs, …)` so they land when the projectile finishes traveling — not at cast time (fixes the current synchronous impact bug).
- **Per-hit slow sync:** For each entry in `data.hits`, spawn an immediate frost burst at the struck enemy's position (`ctx.enemyMeshes()` lookup, y offset ~0.6) via `spawnHitSpark` / `spawnParticleBurst` with icy accent colors. These fire on `CARD_USED` receipt, matching the server's instant damage + `applySlow` resolution.
- Accent colors come from `getAccentHex(data.cardId)` with sensible ice fallbacks; all optional ctx helpers are guarded (`if (ctx.spawnProjectileTrail)` etc.).
- `ice_ball` remains registered as `ice_ball: renderIceBall` in `CARD_RENDERERS`; no other card renderers are changed.
- Glacial Orb correctly has **no** `windUpMs` in merged card defs — no charge telegraph is expected for this card.
- `pnpm test:quick` still passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Refactor `renderIceBall` (~lines 1565–1593) to mirror the finished `renderFireball` pattern (~lines 1499–1557):
    - Compute `travelMs`, `origin`, `direction`, `impact = pointAlong(origin, direction, data.attackRange ?? 8)`.
    - Cast flourish at `origin` (immediate).
    - `ctx.spawnAttackEffect(origin, direction, { effect: 'ice_ball', range: data.attackRange, projectileTravelMs: travelMs, color, emissive })`.
    - `ctx.spawnProjectileTrail(origin, direction, { range: data.attackRange, travelMs, color, emissive })`.
    - `ctx.scheduleAfter(travelMs, () => { spawnImpactDecal + terminal spawnParticleBurst at impact })`.
    - Loop `data.hits` for per-enemy frost bursts at mesh positions (immediate).
  - Reuse existing helpers `originOf`, `directionOf`, `pointAlong`, `getAccentHex`, `ICE_ACCENT_COLOR`, `ICE_ACCENT_EMISSIVE`.
- **Server reference** (read-only): `ice_ball` in `cardStats.json` has `projectileTravelMs: 1200`, `attackRange: 9`, `slowDurationMs: 3000`, no `windUpMs`. Server `cardEffects.js` applies damage and slow instantly on `CARD_USED`; `projectileTravelMs` is client-facing travel timing only.
- **Payload reference**: server `CARD_USED` emits `{ origin, direction, attackRange, hits, projectileTravelMs, specialEffect: 'slow' }`.
- Depends on sub-ticket 01 (`renderer.js` `ice_ball` branch honoring `projectileTravelMs`).

## Verification: code
