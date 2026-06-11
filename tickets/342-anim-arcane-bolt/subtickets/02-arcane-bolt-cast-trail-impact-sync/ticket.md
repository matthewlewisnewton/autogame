# Arcane Bolt cast, trail, and impact timing sync

Replace the incorrect melee `renderWeaponSwing` path with a dedicated `renderArcaneBolt` so cast, projectile travel, terminal impact, and per-enemy pierce-hit VFX are timed to match server resolution. Arcane Bolt has **no** `windUpMs` (instant weapon cast); there is no DoT or lingering status — only the cast→travel→hit moment.

## Acceptance Criteria

- `renderArcaneBolt` derives a single `travelMs` from `data.projectileTravelMs ?? ATTACK_EFFECT_DURATION` (600 ms default) and passes it to `spawnAttackEffect` as `projectileTravelMs` and to `spawnProjectileTrail` as `travelMs`, so the bolt mesh (sub-ticket 01), trail streak, and terminal impact share one duration constant.
- **Cast:** On `CARD_USED`, a brief arcane channel flourish spawns at the caster origin (`spawnParticleBurst` and/or a small `spawnTelegraphRing`) using `getAccentHex('arcane_bolt')` palette (`0xa78bfa` / `0x7c3aed` fallbacks).
- **Projectile:** `ctx.spawnAttackEffect` uses `effect: 'arcane_bolt'` (not `projectile` or a cone swing) with `range: data.attackRange` (server default 10).
- **Terminal impact:** `spawnImpactDecal` and an arcane spark `spawnParticleBurst` at max range are deferred via `ctx.scheduleAfter(travelMs, …)` so they land when the bolt finishes traveling — not at cast time.
- **Per-hit pierce sync:** For each entry in `data.hits`, spawn an immediate arcane hit burst at the struck enemy's position (`ctx.enemyMeshes()` lookup, y offset ~0.6) via `spawnHitSpark` / `spawnParticleBurst` with violet accent colors. These fire on `CARD_USED` receipt, matching the server's instant `collectProjectileHits` resolution (pierce included).
- Accent colors come from `getAccentHex(data.cardId)` with sensible violet fallbacks; all optional ctx helpers are guarded (`if (ctx.spawnProjectileTrail)` etc.).
- `arcane_bolt` is registered as `arcane_bolt: renderArcaneBolt` in `CARD_RENDERERS`; remove it from `renderWeaponSwing` registration and from `WEAPON_SLASH_STYLES` (the melee cone style is wrong for this card).
- Arcane Bolt correctly has **no** `windUpMs` in merged card defs — no charge telegraph is expected for this card.
- `pnpm test:quick` still passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Import `ATTACK_EFFECT_DURATION` from `./config.js`.
  - Add `renderArcaneBolt(data, ctx)` (new function, modeled on `renderFireball` ~lines 1617–1675):
    - Guard on `data.origin`; compute `travelMs`, `origin`, `direction`, `impact = pointAlong(origin, direction, data.attackRange ?? 10)`.
    - Cast flourish at `origin` (immediate).
    - `ctx.spawnAttackEffect(origin, direction, { effect: 'arcane_bolt', range: data.attackRange, projectileTravelMs: travelMs, color, emissive })`.
    - `ctx.spawnProjectileTrail(origin, direction, { range: data.attackRange, travelMs, color, emissive })`.
    - `ctx.scheduleAfter(travelMs, () => { spawnImpactDecal + terminal spawnParticleBurst at impact })`.
    - Loop `data.hits` for per-enemy pierce hit bursts at mesh positions (immediate).
  - Update `CARD_RENDERERS`: `arcane_bolt: renderArcaneBolt` (replace `renderWeaponSwing`).
  - Remove the `arcane_bolt` entry from `WEAPON_SLASH_STYLES` (~lines 194–205).
  - Reuse existing helpers `originOf`, `directionOf`, `pointAlong`, `getAccentHex`.
- **Server reference** (read-only): `arcane_bolt` uses `effect: 'projectile'` in `cardStats.json` with `attackRange: 10`, `projectile.pierces: true`, no `windUpMs`, no `projectileTravelMs`. Server `CARD_USED` (~`cardEffects.js` line 543) emits `{ origin, direction, attackRange, hits, effect: 'projectile' }` with instant damage resolution. Client travel is visual-only over `ATTACK_EFFECT_DURATION`; per-hit sparks align with immediate server hits.
- Depends on sub-ticket 01 (`renderer.js` `arcane_bolt` branch honoring `projectileTravelMs`).

## Verification: code
