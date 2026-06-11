# Bespoke Cinder Snare ember-snare renderer (themed + timing-synced)

Cinder Snare currently falls back to the generic `renderGroundEnchantment`
(a single plain orange ring) — indistinguishable from any other ground
enchantment and not recognizable as a fiery "Cinder Snare". Replace it with a
dedicated renderer that reads unmistakably as a smoldering ember/cinder snare,
themed to the card's fiery accent and with its lingering smolder cadence
derived from the server effect stats (no perf regression, client test).

## Acceptance Criteria

- `cinder_snare` is registered to a new dedicated renderer function (e.g.
  `renderCinderSnare`) in the `CARD_RENDERERS` registry — it no longer points
  at the shared `renderGroundEnchantment`.
- `resolveRenderers('cinder_snare')` still returns exactly one renderer fn, and
  it is a DIFFERENT function object than `resolveRenderers('spike_trap')[0]`
  (the existing "spike_trap resolves to a different renderer fn than
  cinder_snare" test continues to pass).
- On a `CARD_USED` event for `cinder_snare` (payload: `origin {x,z}`, `radius`,
  `effect: 'cinder_snare'`), the renderer spawns a fiery ember-snare at the
  placement origin/radius using existing 315 VFX primitives — a low fiery
  ground ring/coil plus an ember particle burst — visibly orange/red and
  distinct from the spike_trap steel/blood-red look.
- The renderer is themed to the card accent: it uses the cinder_snare accent
  color (card accent `#f97316`, fiery-orange/inferno-red emissive) rather than
  the generic `0xf87171/0xef4444` ground-enchantment palette.
- The lingering smolder duration and tick cadence are DERIVED FROM the card's
  server stats (read `ttlMs`, `dotTicks`, `dotIntervalMs`, `radius` from the
  card def via `getCardDef('cinder_snare')`, with the same numeric fallbacks
  used elsewhere), NOT hardcoded magic numbers — so the visual stays in sync if
  the server stats change. The lingering smolder pulses align to
  `dotIntervalMs` and the overall lingering visual reflects the snare's `ttlMs`.
- cinder_snare has NO `windUpMs`: the renderer fires synchronously at cast with
  no `setTimeout`/projectile delay gating the initial placement VFX (it may use
  `ctx.scheduleAfter` for the subsequent lingering smolder pulses, mirroring
  `renderInfernoPillar`).
- No new network traffic and no server payload changes (client-only); guards
  against a missing `radius`/`origin` so a malformed event is a no-op.
- A client test covers the new renderer: it asserts the registry mapping, the
  primitive calls at the placement origin/radius, the fiery accent color, and
  that the lingering cadence/duration are derived from the card stats.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderCinderSnare(data, ctx)`. Model it on `renderInfernoPillar`
    (lines ~725–777) and `renderSpikeTrap` (lines ~1296–1303): guard on
    `data.radius === undefined`; compute `origin = originOf(data)`; resolve
    `color = getAccentHex('cinder_snare') ?? 0xf97316` and a fiery emissive;
    pull `dotTicks`, `dotIntervalMs`, `ttlMs`, `radius` from
    `getCardDef('cinder_snare')` (fallbacks `4`, `500`, `30000`, `2.5`).
  - Spawn the initial ember snare via existing primitives:
    `ctx.spawnInfernoPillarEffect(origin, radius, { color, emissive, dotTicks,
    dotIntervalMs, duration })` and/or `ctx.spawnTelegraphRing` +
    `ctx.spawnParticleBurst` (and optionally `ctx.spawnImpactDecal`) — all
    already available on the render ctx and used by `renderInfernoPillar`.
  - Add lingering smolder pulses with `ctx.scheduleAfter(dotIntervalMs * tick,
    …)` to read as a ticking fiery hazard; keep the look themed and distinct
    from spike_trap.
  - Update the registry: `cinder_snare: renderCinderSnare` (currently
    `cinder_snare: renderGroundEnchantment` at line ~1557). Leave
    `renderGroundEnchantment` in place if other cards/tests reference it.
- `game/client/test/cardRenderers.test.js`: extend the existing
  "renderCardUsed() — enchantment dispatch" describe block with a cinder_snare
  case (registry mapping, primitive calls/origin/radius, accent color, and
  stat-derived cadence). Use the existing `makeCtx()` recording-ctx helper.
- Do NOT touch `game/server/**`, `renderer.js` mesh sync, or the spike_trap /
  mirror_ward renderers — stay within this card's render fn + its registration
  plus its client test, to avoid conflicts with the other per-card animation
  beads.

## Verification: code
