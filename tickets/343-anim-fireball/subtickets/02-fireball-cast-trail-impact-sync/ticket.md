# Fireball cast, trail, and impact timing sync

Rewrite `renderFireball` so cast, projectile travel, terminal impact, and per-enemy ignition VFX are timed to match server resolution. Fireball has **no** `windUpMs` (instant weapon cast); ongoing burn flames remain driven by broadcast `burningUntil` (291) — this ticket only covers the cast→travel→ignite moment.

## Acceptance Criteria

- `renderFireball` derives a single `travelMs` from `data.projectileTravelMs ?? ATTACK_EFFECT_DURATION` (600 ms default) and passes it to `spawnAttackEffect` as `projectileTravelMs` and to `spawnProjectileTrail` as `travelMs`, so the projectile mesh (sub-ticket 01), trail streak, and terminal impact share one duration constant.
- **Cast:** On `CARD_USED`, a brief fire channel flourish spawns at the caster origin (`spawnParticleBurst` and/or a small `spawnTelegraphRing`) using `getAccentHex('fireball')` palette (`0xf97316` / `0xff3b00` fallbacks).
- **Terminal impact:** `spawnImpactDecal` and the large ember `spawnParticleBurst` at max range are deferred via `ctx.scheduleAfter(travelMs, …)` so they land when the projectile finishes traveling — not at cast time.
- **Per-hit ignition (server sync):** For each entry in `data.hits`, spawn an immediate ignite burst at the struck enemy's position (`ctx.enemyMeshes()` lookup, y offset ~0.6) via `spawnHitSpark` / `spawnParticleBurst` with fire accent colors. These fire on `CARD_USED` receipt, matching the server's instant damage + `applyBurning` resolution.
- Accent colors come from `getAccentHex(data.cardId)` with sensible fire fallbacks; all optional ctx helpers are guarded (`if (ctx.spawnProjectileTrail)` etc.).
- `fireball` remains registered as `fireball: renderFireball` in `CARD_RENDERERS`; no other card renderers are changed.
- Fireball correctly has **no** `windUpMs` in merged card defs — no charge telegraph is expected for this card.
- `pnpm test:quick` still passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Import `ATTACK_EFFECT_DURATION` from `./config.js`.
  - Refactor `renderFireball` (~lines 963–990):
    - Compute `travelMs`, `origin`, `direction`, `impact = pointAlong(origin, direction, data.attackRange ?? 8)`.
    - Cast flourish at `origin` (immediate).
    - `ctx.spawnAttackEffect(origin, direction, { effect: 'fireball', range: data.attackRange, projectileTravelMs: travelMs, color, emissive })`.
    - `ctx.spawnProjectileTrail(origin, direction, { range: data.attackRange, travelMs, color, emissive })`.
    - `ctx.scheduleAfter(travelMs, () => { spawnImpactDecal + terminal spawnParticleBurst at impact })`.
    - Loop `data.hits` for per-enemy ignite bursts at mesh positions (immediate).
  - Reuse existing helpers `originOf`, `directionOf`, `pointAlong`, `getAccentHex`.
- Depends on sub-ticket 01 (`renderer.js` fireball branch honoring `projectileTravelMs`).

## Verification: code
