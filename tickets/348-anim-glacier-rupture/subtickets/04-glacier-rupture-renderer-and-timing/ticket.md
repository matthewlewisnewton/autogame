# Glacier Rupture — renderer polish and server timing sync

Implement (or verify) `renderGlacierCollapse` and its render-context wiring so Glacier Rupture composes the sub-ticket 01 primitive with 315 VFX helpers, reads unmistakably as a glacier collapse/shatter, and fires all VFX synchronously at `CARD_USED` to match the server's 700 ms wind-up-then-instant-radial resolution. Sub-ticket 03 already updated `cardRenderers.test.js`; this sub-ticket must keep that suite green.

## Acceptance Criteria

- `renderGlacierCollapse` calls `ctx.spawnGlacierRuptureEffect(origin, data.radius, { color: GLACIER_COLOR, emissive: GLACIER_EMISSIVE })` as the primary rupture visual — **no** `spawnSummonEffect`.
- A full-radius icy telegraph (`spawnTelegraphRing` at `origin` with `data.radius`), ground impact flourish (`spawnImpactDecal` at `origin`), and origin radial shatter spray (`spawnParticleBurst` with glacier palette, count ~16, spread ~2.4) fire **synchronously at `CARD_USED`** — no `setTimeout`, no `ctx.scheduleAfter`, no projectile-travel delay.
- For each entry in `data.hits` whose enemy has a live mesh in `ctx.enemyMeshes()`, spawn per-hit shatter bursts (`spawnHitSpark` and/or `spawnParticleBurst`) at the enemy position with the glacier palette; hits with `frozenShatter: true` use a larger burst (higher `count`/`spread`) than normal freeze hits. Skip hits whose `enemyId` has no mesh or mesh lacks `position` without throwing.
- The renderer uses the **fixed glacier palette** (`GLACIER_COLOR 0x38bdf8` / `GLACIER_EMISSIVE 0x0ea5e9`), not `getAccentHex`.
- `getCardDef('glacier_collapse').windUpMs` is **700** — the renderer does not add its own wind-up delay (`CARD_USED` arrival is the sync point; shared 307/315 charge telegraph handles wind-up).
- `glacier_collapse: renderGlacierCollapse` registration is unchanged; `frost_nova` and `permafrost_lance` renderers are untouched.
- All optional ctx helpers are guarded (`if (ctx.spawnGlacierRuptureEffect)` etc.) so partial ctx objects do not throw.
- `main.js` `cardRenderCtx` exposes `spawnGlacierRuptureEffect` from `renderer.js`; `socketHandlers/cardHandlers.js` and `socketHandlers/socketHandlerCtx.js` pass it through; the ctx comment block in `cardRenderers.js` documents the primitive.
- `cd game && pnpm test:quick` passes with no regressions in `cardRenderers.test.js` or `vfx-primitives.test.js` (sub-ticket 03 assertions must remain satisfied).
- Depends on sub-tickets **01** (primitive) and **03** (test contract already merged).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Update the ctx interface comment block (~L13–40) to document `spawnGlacierRuptureEffect(origin, radius, style?)` if not already present.
  - Implement/verify `renderGlacierCollapse` (~L658–691):
    1. Guard on `data.radius === undefined` (early return).
    2. Resolve `origin = originOf(data)`; build `palette = { color: GLACIER_COLOR, emissive: GLACIER_EMISSIVE }`.
    3. `spawnGlacierRuptureEffect(origin, data.radius, palette)`.
    4. `spawnTelegraphRing(origin, data.radius, palette)`.
    5. `spawnImpactDecal(origin, palette)`.
    6. `spawnParticleBurst(origin, { ...palette, count: 16, spread: 2.4 })`.
    7. Loop `data.hits` for per-enemy shatter bursts; scale for `hit.frozenShatter`.
  - Keep `GLACIER_COLOR` / `GLACIER_EMISSIVE` constants and `glacier_collapse: renderGlacierCollapse` registration.
- **`game/client/main.js`**: import `spawnGlacierRuptureEffect` from `./renderer.js`; add to `createSocketHandlerCtx` deps / `cardRenderCtx`.
- **`game/client/socketHandlers/cardHandlers.js`** and **`game/client/socketHandlers/socketHandlerCtx.js`**: wire `spawnGlacierRuptureEffect` through `createCardRenderCtx` like other bespoke primitives.
- **`game/client/renderer.js`**: read-only consumer of `spawnGlacierRuptureEffect` export (owned by sub-ticket 01).
- **Server reference** (read-only): `cardStats.json` — `windUpMs: 700`, `freezeDurationMs: 2500`, `specialEffect: 'shatter'`; `cardEffects.js` `frost_nova`/`glacier_collapse` branch resolves instant radial freeze+damage on `CARD_USED`. Do not modify server code.
- Do **not** modify other card renderers, shared card data, or sub-ticket 03 test expectations unless a clear bug is found.

## Verification: code
