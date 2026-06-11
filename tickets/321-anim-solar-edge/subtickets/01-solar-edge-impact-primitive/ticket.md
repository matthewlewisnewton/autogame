# Solar Edge — solar impact VFX primitive

Add a dedicated Solar Edge impact flourish in `renderer.js` so the strike reads unmistakably as a **solar blade edge** — a radiant gold-white core with an orange corona — rather than reusing the generic ground decal or greatsword debris burst. This primitive is the visual foundation sub-ticket 02 composes via the card renderer.

## Acceptance Criteria

- `spawnSolarEdgeImpactFlourish(origin, direction, style = {})` creates a brief solar strike flourish at the blade's impact point (default placement: `pointAlong(origin, direction, style.range ?? ATTACK_RANGE)`):
  1. A bright gold-white solar disc burst (body default `0xfef08a`, emissive `0xfbbf24`) at the strike point.
  2. An expanding orange corona ring (emissive `0xff7a18` / `0xff3b00`) sized to the strike radius (default ring radius ~1.8–2.2).
  3. A short scatter of solar ember particles at the impact point (count ~10–14).
- Default duration aligns with `ATTACK_EFFECT_DURATION` when `style.duration` is omitted.
- Palette is overridable via `style.color`, `style.emissive`, `style.coronaColor`, `style.coronaEmissive`, and `style.range`.
- The primitive registers meshes in `activeEffects` with finite `duration`, a distinct flag (e.g. `isSolarEdgeImpact`), and cleanup via `updateAttackEffects()`.
- Every mesh is added to `window.___test_scene || scene`; no per-frame allocation in the update loop.
- The primitive is pure additive VFX: no network traffic, no server changes, no changes to `cardRenderers.js` or other cards' renderers in this sub-ticket.
- `game/client/test/vfx-primitives.test.js` adds smoke tests: each call pushes expected `activeEffects` entries with the solar palette, finite duration, and cleanup after `updateAttackEffects()` past duration.

## Technical Specs

- **`game/client/renderer.js`**:
  - Define palette constants near other VFX blocks (e.g. `SOLAR_EDGE_CORE_COLOR = 0xfef08a`, `SOLAR_EDGE_CORE_EMISSIVE = 0xfbbf24`, `SOLAR_EDGE_CORONA_COLOR = 0xff7a18`, `SOLAR_EDGE_CORONA_EMISSIVE = 0xff3b00`).
  - Implement `spawnSolarEdgeImpactFlourish(origin, direction, style = {})` — solar disc + corona ring + ember scatter at the strike point along `direction`.
  - Export the function; add `updateAttackEffects()` branches for the new flag.
- **`game/client/test/vfx-primitives.test.js`**: import the primitive; assert `activeEffects` entries, palette, finite duration, and post-duration cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, or server code in this sub-ticket.

## Verification: code
