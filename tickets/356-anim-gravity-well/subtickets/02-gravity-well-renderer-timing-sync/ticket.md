# Gravity Well — renderer composition and timing sync

Rewrite `renderGravityWell` to compose the sub-ticket 01 pull primitive with 315 VFX helpers so the cast reads unmistakably as a gravity singularity whose **primary collapse fires synchronously** on `CARD_USED`, matching the server's instant `pullEnemiesToward` resolution. Gravity Well has **no** `windUpMs` (instant spell cast), **no** projectile travel, and **no** DoT — remove any travel-implying deferral. Depends on sub-ticket 01 (`spawnGravityWellEffect` primitive + ctx wiring).

## Acceptance Criteria

- `renderGravityWell` calls `ctx.spawnGravityWellEffect(origin, data.radius, { color, emissive, duration })` where `radius` is the server-emitted pull radius (`pullRadius` 12) and `duration` defaults to `ATTACK_EFFECT_DURATION` (600 ms).
- **Instant cast (t = 0):** On `CARD_USED` receipt, the pull primitive and a brief center `spawnImpactDecal` at the origin fire **synchronously** — no `scheduleAfter` delay for the primary pull moment, matching the server's immediate `pullEnemiesToward` in `cardEffects.js`.
- **Per-pulled-enemy sync:** When `data.pulled` is a non-empty array, for each `{ enemyId }` entry spawn an immediate inward pull streak from the enemy's live mesh position toward the cast origin via `ctx.spawnLightningArc` and/or `ctx.spawnParticleBurst` with inward styling (reuse soul-drain tether pattern but direction **enemy → origin**). Skip entries whose enemy mesh is absent.
- The renderer **does not** call `spawnTelegraphRing` (outward expand) or generic outward `spawnParticleBurst` as the primary effect — those are replaced by `spawnGravityWellEffect`.
- Accent colors come from `getAccentHex(data.cardId)` with Gravity Well fallbacks (`0xc084fc` / `0xa855f7`); all optional ctx helpers are guarded (`if (ctx.spawnGravityWellEffect)` etc.).
- `CARD_DEFS.gravity_well` has no positive `windUpMs` — no 307 charge telegraph is expected; a test assertion documents this.
- `gravity_well: renderGravityWell` registration in `CARD_RENDERERS` is unchanged; no other card renderers are modified.
- Existing radius guard preserved: when `data.radius === undefined`, no VFX fires.
- `pnpm test:quick` still passes.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Import `ATTACK_EFFECT_DURATION` from `./config.js` if not already in scope.
  - Refactor `renderGravityWell` (~L684–698):
    1. Guard on `data.radius === undefined` (keep existing early return).
    2. Resolve `origin`, `color`/`emissive` from `getAccentHex(data.cardId)` with `GRAVITY_WELL_COLOR` / `GRAVITY_WELL_EMISSIVE` fallbacks.
    3. Call `ctx.spawnGravityWellEffect(origin, data.radius, { color, emissive, duration: ATTACK_EFFECT_DURATION })` synchronously.
    4. Optional immediate `ctx.spawnImpactDecal(origin, { color, emissive })` at the singularity core (t = 0).
    5. Loop `Array.isArray(data.pulled) ? data.pulled : []` for per-enemy inward arcs via `ctx.spawnLightningArc(enemyPos, origin, PULL_STREAK_STYLE)` when meshes exist.
    6. Remove the `spawnTelegraphRing` + generic outward `spawnParticleBurst` primary calls.
  - Update the ctx primitive comment block (~L21) to document `spawnGravityWellEffect(origin, radius, style?)`.
  - Define a `GRAVITY_WELL_PULL_STREAK_STYLE` constant (purple accent, short duration) near the other spell style blocks.
- **Server reference** (read-only): `cardEffects.js` `gravity_well` branch emits `CARD_USED` with `{ origin, radius, pulled, specialEffect: 'pull' }` and resolves pull instantly — no `windUpMs`, no projectile, no lingering area effect.
- Do **not** modify `spawnGravityWellEffect` internals (owned by sub-ticket 01), server code, or `event_horizon` renderer.

## Verification: code
