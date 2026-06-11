# Telepipe renderer polish and server timing sync

Rewrite `renderTelepipe` so the cast flourish reads unmistakably as an evacuation portal and fires in sync with the server's instant placement resolution. Telepipe has **no** `windUpMs` (instant spell cast, no 307 charge telegraph) and **no** projectile travel — the portal appears at the caster's feet when `CARD_USED` arrives.

## Acceptance Criteria

- `telepipe` resolves to a dedicated `renderTelepipe` in `CARD_RENDERERS` (registration already exists; replace the implementation).
- On `CARD_USED` receipt (`cardEffects.js` telepipe branch), VFX fire **synchronously** inside `renderTelepipe` — no `scheduleAfter`, no artificial delay, no wind-up telegraph dependency. Timing matches the server's immediate `state.telepipe = { x, z, … }` + `STATE_UPDATE` placement (server reference: `game/server/cardEffects.js` ~L606–638).
- `renderTelepipe` guards on `data.origin` and no-ops when absent.
- Cast composition at `originOf(data)`:
  - `ctx.spawnTelepipeCastEffect(origin, radius, { color, emissive })` using the primitive from sub-ticket 01.
  - `ctx.spawnTelegraphRing(origin, radius, …)` with a short pulse (`SUMMON_EFFECT_DURATION`) marking the shared evac footprint.
  - `ctx.spawnParticleBurst` at `{ x: origin.x, y: 1.0, z: origin.z }` with cyan accent particles (modest count/spread).
- `radius` defaults to `2.5` (server `PORTAL_RADIUS`); honor `data.radius` when present.
- Accent colors from `getAccentHex('telepipe')` with cyan fallbacks (`0x67e8f9` / `0x22d3ee`).
- `getCardDef('telepipe').windUpMs` is absent or zero — renderer does not depend on the 307 wind-up charge telegraph.
- `main.js` `cardRenderCtx` exposes `spawnTelepipeCastEffect` from `renderer.js`.
- All optional ctx helpers are guarded (`if (ctx.spawnTelepipeCastEffect)` etc.).
- No changes to other card renderers, server code, or persistent portal sync (`lootSync.js`).
- Depends on sub-ticket 01 (`spawnTelepipeCastEffect` must exist).
- Do **not** add tests in this sub-ticket (owned by sub-ticket 03).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Add Telepipe palette constants (`TELEPIPE_COLOR`, `TELEPIPE_EMISSIVE`).
  - Import `SUMMON_EFFECT_DURATION` from `./config.js` and `getCardDef` from `./cards.js` (if not already imported).
  - Rewrite `renderTelepipe` (~L1371–1375):
    1. Early return unless `data.origin`.
    2. `origin = originOf(data)`; `radius = data.radius ?? 2.5`.
    3. `color` / `emissive` from `getAccentHex(data.cardId)` with fallbacks.
    4. Call `ctx.spawnTelepipeCastEffect`, `ctx.spawnTelegraphRing`, `ctx.spawnParticleBurst` synchronously.
  - Update the ctx primitive comment block (~L15–30) to document `spawnTelepipeCastEffect`.
  - Keep `telepipe: renderTelepipe` in `CARD_RENDERERS`.
- **`game/client/main.js`**:
  - Import `spawnTelepipeCastEffect as rendererSpawnTelepipeCastEffect` from `./renderer.js`.
  - Add `spawnTelepipeCastEffect: rendererSpawnTelepipeCastEffect` on `cardRenderCtx`.
- **Server reference** (read-only): `CARD_USED` payload is `{ playerId, cardId, slotIndex, specialEffect: 'portal', effect: 'telepipe', origin: { x, z } }` with `magicStoneCost: 0`, no `windUpMs`, no `hits`, no projectile fields (`game/shared/cardStats.json`).

## Verification: code
