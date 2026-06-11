# Ether Siphon — renderer polish and server timing sync

Upgrade `renderManaLeach` to compose the new ether-siphon primitive (sub-ticket 01) with 315 VFX helpers so the cast reads as an instant radial mana drain whose per-hit siphon arcs and magic-stone absorption sync to the server's immediate `collectRadialHits` resolution. Ether Siphon has **no** `windUpMs` (instant spell cast).

## Acceptance Criteria

- `renderManaLeach` calls `ctx.spawnEtherSiphonEffect(origin, data.radius, { color, emissive, duration })` using `getAccentHex('mana_leach')` (`0xa855f7`) with emissive fallback `0x9333ea`.
- **Instant cast (t = 0):** On `CARD_USED` receipt, synchronously spawns the ether-siphon primitive plus a cast flourish (`spawnTelegraphRing` at `data.radius` and `spawnParticleBurst` at origin) — matching the server's immediate radial resolution (no projectile travel, no `scheduleAfter` delay for the initial hit). Confirms timing matches `cardEffects.js` radial fallback branch where damage and `magicStonesGained` resolve in the same tick.
- **Per-hit siphon sync:** For each entry in `data.hits`, spawn an immediate drain tendril from the struck enemy's mesh position (`ctx.enemyMeshes()` lookup, y ≈ 0.6) back to the caster origin via `ctx.spawnLightningArc(enemyPos, origin, { color, emissive, duration: ATTACK_EFFECT_DURATION })`, plus a compact `spawnHitSpark` and/or `spawnParticleBurst` at the enemy — visually showing ether being pulled from each victim.
- **Magic-stone absorption:** When `data.magicStonesGained > 0`, spawn an additional absorption flourish at the caster origin (`spawnParticleBurst` with higher count/spread and/or `spawnImpactDecal`) so MS gain reads at the siphon source.
- `getCardDef('mana_leach').windUpMs` is absent or zero — renderer does not depend on the 307 wind-up charge telegraph for this card.
- `mana_leach: renderManaLeach` registration is unchanged; `battle_familiar` and `soul_drain` renderers are untouched.
- All optional ctx helpers are guarded (`if (ctx.spawnLightningArc)` etc.).
- `main.js` `cardRenderCtx` exposes `spawnEtherSiphonEffect` from `renderer.js`; the ctx comment block in `cardRenderers.js` documents the new primitive.
- Depends on sub-ticket 01 (`spawnEtherSiphonEffect` must exist).
- Do **not** add or update tests in this sub-ticket (owned by sub-ticket 03).

## Technical Specs

- **`game/client/renderer.js`**: sub-ticket 01 owns primitive internals; this ticket only imports/exports are consumed downstream.
- **`game/client/main.js`**: import `spawnEtherSiphonEffect as rendererSpawnEtherSiphonEffect` from `./renderer.js`; add `spawnEtherSiphonEffect: rendererSpawnEtherSiphonEffect` on `cardRenderCtx`.
- **`game/client/cardRenderers.js`**:
  - Update the ctx interface comment block (~L13–35) to document `spawnEtherSiphonEffect(origin, radius, style?)`.
  - Rewrite `renderManaLeach` (~L887–901):
    1. Guard on `data.radius === undefined` (keep existing early return).
    2. Resolve `origin`, `color`/`emissive` from `getAccentHex(data.cardId)`.
    3. Call `ctx.spawnEtherSiphonEffect(origin, data.radius, { color, emissive })`.
    4. Immediate cast flourish: `spawnTelegraphRing` + `spawnParticleBurst` at `origin`.
    5. Loop `data.hits` for per-enemy drain arcs and hit sparks (immediate, synchronous).
    6. When `data.magicStonesGained > 0`, spawn MS absorption flourish at `origin`.
  - Keep `MANA_LEACH_COLOR` / `MANA_LEACH_EMISSIVE` constants; ensure helper-call signature differs from `renderBattleFamiliar` and `renderSoulDrain`.
- **Server reference** (read-only): `cardEffects.js` radial fallback (~L1149–1183) emits `CARD_USED` with `{ origin, radius: SUMMON_RADIUS (10), hits, magicStonesGained, specialEffect: 'mana_drain' }` at instant resolution. Card stats: `damage: 28`, `magicStoneOnHit: 8`, `magicStoneCost: 30`. No `windUpMs`, no DoT, no projectile.
- Do **not** modify server code or other card renderers.

## Verification: code
