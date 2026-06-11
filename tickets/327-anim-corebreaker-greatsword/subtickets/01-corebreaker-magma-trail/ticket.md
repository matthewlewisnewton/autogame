# Corebreaker Greatsword: dedicated molten swing + lingering fire-trail DoT synced to server

Give `magma_greatsword` (Corebreaker Greatsword) its own dedicated card renderer
instead of sharing the generic `renderHeavyGreatsword` with `steel_claymore`, so
its animation reads unmistakably as a molten magma greatsword. The new renderer
keeps the heavy magma cone swing + impact, then lays a lingering molten
**fire-trail DoT** along the swing direction whose tick cadence/duration is
DERIVED from the server card stats (`fire_trail`: `dotTicks` 4 × `dotIntervalMs`
500ms, `trailDamagePerTick`) — the signature effect that is currently invisible.

## Acceptance Criteria

- `magma_greatsword` resolves to a NEW dedicated render function (e.g.
  `renderCorebreakerGreatsword`), distinct from the function used by
  `steel_claymore`. `resolveRenderers('magma_greatsword')[0] !== resolveRenderers('steel_claymore')[0]`, and neither is the weapon-type default.
- The dedicated renderer still emits the heavy magma swing: a wide magma cone
  (`coneAngle ≈ Math.PI/1.8`, `range 7`, magma accent `0xf97316` / emissive
  `0xff3b00`) plus a pronounced impact (large `spawnImpactDecal` radius ≈ 3.8 and
  high-`count` `spawnParticleBurst` ≈ 24) at the strike point, preserving the
  card's existing "biggest decal/debris" weight.
- The renderer composes the 315 directional fire-zone primitive
  (`spawnDragonsBreathEffect` or equivalent lingering directional zone) along the
  swing direction so a molten trail visibly lingers after the swing, themed to the
  magma accent.
- The lingering trail emits one molten pulse per DoT tick via `ctx.scheduleAfter`,
  with the tick count and interval DERIVED from `getCardDef('magma_greatsword')`
  (`dotTicks`, `dotIntervalMs`) — NOT hardcoded — so the on-screen cadence stays
  synced to the server `fire_trail` resolution (4 ticks at 500ms). Trail duration
  derives from `dotTicks * dotIntervalMs`.
- The primary swing + impact fire synchronously on `CARD_USED` (no artificial
  projectile delay); the 800ms wind-up charge telegraph is left to the existing
  automatic renderer.js wind-up handler — the card renderer must NOT re-implement
  the wind-up telegraph.
- `swingCount > 1` and the `photon_barrage` stagger are still honored as in the
  prior heavy-greatsword behavior.
- Every `ctx.*` primitive call is guarded so the renderer degrades gracefully
  (no throw) when an optional primitive is absent.
- No server payload / network changes: all derived stats come from
  `getCardDef`, not new `CARD_USED` fields.
- `steel_claymore` behavior is unchanged (it keeps `renderHeavyGreatsword`).
- The full client vitest suite passes, including updated assertions in
  `game/client/test/cardRenderers.test.js`.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add a dedicated `renderCorebreakerGreatsword(data, ctx)` function (model it on
    `renderHeavyGreatsword` for the swing/impact and on `renderDragonsBreath` /
    `renderCinderSnare` for the stat-derived lingering DoT loop). Derive
    `dotTicks` / `dotIntervalMs` from `getCardDef('magma_greatsword')`. Keep the
    existing magma style values (color `0xf97316`, emissive `0xff3b00`,
    `coneAngle Math.PI/1.8`, `range 7`, `decalRadius 3.8`, `debrisCount 24`,
    `debrisSpread 2.8`) — reuse the `HEAVY_GREATSWORD_STYLES.magma_greatsword`
    entry or a dedicated style const.
  - Use `getAccentHex('magma_greatsword')` with the style color as fallback, like
    the other styled blades.
  - Change the registration at the renderer map (currently
    `magma_greatsword: renderHeavyGreatsword`) to point at the new function. Leave
    `steel_claymore: renderHeavyGreatsword` untouched.
- `game/client/test/cardRenderers.test.js`:
  - Update the test asserting `steel_claymore` and `magma_greatsword` share the
    same renderer (≈ line 150) to instead assert they now resolve to DISTINCT
    renderers (both still non-default).
  - Update/relax the "heavy greatswords do not emit telegraph ring" test (≈ line
    1583) and any other test that loops both cards but whose expectation the new
    magma trail breaks (e.g. graceful-degradation, distinct-color, hit-harder
    tests) so they reflect magma's new trail without weakening `steel_claymore`
    coverage. Keep/extend the "Corebreaker erupts a wide magma swing with the
    biggest decal/debris" assertion (≈ line 1556).
  - Add coverage asserting: (a) `magma_greatsword` resolves to its own dedicated
    renderer; (b) firing it schedules `dotTicks` lingering pulses at
    `dotIntervalMs` cadence derived from the card def; (c) it still emits the
    heavy magma swing + large impact decal/burst; (d) it degrades without throwing
    when optional primitives are absent.

## Verification: code
