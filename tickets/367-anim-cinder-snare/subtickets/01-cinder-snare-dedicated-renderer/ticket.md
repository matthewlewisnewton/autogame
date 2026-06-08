# Cinder Snare dedicated renderer

Split `cinder_snare` out of the shared `renderGroundEnchantment` path used by
Spike Trap. Register a card-specific `renderCinderSnare` renderer so later
polish targets only this enchantment without touching Spike Trap's hostile-red
trap preview.

## Acceptance Criteria

- `cinder_snare` is registered in `CARD_RENDERERS` and resolves to a dedicated
  renderer function — not `renderGroundEnchantment` and not a type default.
- `spike_trap` still resolves to `renderGroundEnchantment`; only `cinder_snare`
  moves to the new renderer.
- The new renderer composes at least one 315 primitive for a cinder/fire
  placement telegraph: `ctx.spawnTelegraphRing` or `ctx.spawnSummonEffect` at
  `data.radius` with the cinder accent palette (`getAccentHex('cinder_snare')`
  fallback `0xf97316` / emissive `0xff3b00`), guarded with `if (ctx.spawn…)`.
- `renderCinderSnare` returns early when `data.radius === undefined` (same
  guard pattern as `renderGroundEnchantment`).
- Firing `renderCardUsed` for `cinder_snare` through a recording ctx emits at
  least one primitive call with the cinder accent color (not Spike Trap's red
  `0xf87171`).
- Existing client + server vitest suites still pass.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `CINDER_SNARE_COLOR` / `CINDER_SNARE_EMISSIVE` constants (or equivalent)
    using accent `#f97316` / ember `0xff3b00`.
  - Add `renderCinderSnare(data, ctx)` — initial placement telegraph only
    (theme layering comes in sub-ticket 02).
  - Change `CARD_RENDERERS.cinder_snare` from `renderGroundEnchantment` to
    `renderCinderSnare`.
  - Reuse `originOf` and `getAccentHex`; do not alter `renderGroundEnchantment`
    or `spike_trap` registration.
- `game/client/test/cardRenderers.test.js`:
  - Assert `resolveRenderers('cinder_snare')[0]` is not
    `resolveRenderers('spike_trap')[0]`.
  - Add a recording-ctx test that fires `cinder_snare` with
    `{ origin, radius: 2.5 }` and checks for cinder palette on at least one
    primitive call.

## Verification: code
