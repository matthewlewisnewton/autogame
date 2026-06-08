# Heal spell distinct cast / impact VFX

Split the shared `renderHealRestore` renderer so Restoration Beacon (`healing_font`) and Sanctum Pulse (`divine_grace`) each have a bespoke cast/impact visual with different helpers, palettes, and registry entries. This closes the last per-card spell animation gap from round-1 review.

## Acceptance Criteria

- `healing_font` and `divine_grace` are registered in `CARD_RENDERERS` with separate renderer functions (not a shared `renderHealRestore`).
- `renderHealingFont` uses a restoration-beacon signature distinct from divine grace: compose 315 primitives at `data.origin` with the card's green accent (`#86efac` / `0x86efac`) — e.g. `spawnTelegraphRing` at `data.radius` plus `spawnParticleBurst` at origin (or a dedicated `spawnHealingFontHealRing` helper with the same green palette). It must **not** call `spawnDivineGraceEffect`.
- `renderDivineGrace` keeps the golden sanctum signature via `spawnDivineGraceEffect(origin, radius)` with `#fde68a` / gold palette; may add a secondary flourish (e.g. `spawnParticleBurst` with gold emissive) so its primitive mix differs from `healing_font`.
- Both renderers no-op when `data.radius` is undefined; both play `ctx.playSound('heal')` only when `data.hpGained > 0` and `data.playerId === ctx.myId` (preserve existing heal-sound behavior).
- Vitest proves the two cards dispatch to different renderer functions and produce different ctx helper call signatures when given identical payload shapes.
- Existing `every spell card has a bespoke renderer` coverage test still passes; `pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Remove `renderHealRestore`.
  - Add `renderHealingFont` and `renderDivineGrace` with distinct helper/palette mixes as above.
  - Register `healing_font: renderHealingFont` and `divine_grace: renderDivineGrace` separately in `CARD_RENDERERS`.
- `game/client/renderer.js` (only if a dedicated green heal ring reads better than raw telegraph primitives):
  - Add `spawnHealingFontHealRing(origin, radius)` with green `#86efac` material (distinct from `spawnDivineGraceEffect` gold and `spawnPurifyingPulseHealRing` mint).
  - Wire through `main.js` ctx if added.
- `game/client/test/cardRenderers.test.js`:
  - Update `healing_font` tests to assert the new green restoration signature (e.g. `spawnTelegraphRing` / `spawnHealingFontHealRing`) and **not** `spawnDivineGraceEffect`.
  - Update `divine_grace` tests to assert `spawnDivineGraceEffect` is called and the helper mix differs from `healing_font`.
  - Add a test that `resolveRenderers('healing_font')[0] !== resolveRenderers('divine_grace')[0]` and that rendering both with the same `{ origin, radius, hpGained, hits }` payload yields non-identical `_calls` helper sequences.

Payload reference (server `cardUsed`): both emit `{ origin, radius: SUMMON_RADIUS, hpGained, playerId, hits }`.

## Verification: code
