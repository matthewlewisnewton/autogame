# Heavy wind-up greatsword impacts

Give the heavy wind-up greatswords distinct, weighty slash/impact visuals that
read as big committed hits, composing the 315 primitives: Alloy Greatblade
(`steel_claymore`), Corebreaker Greatsword (`magma_greatsword`), and Excalibur
Photon (`excalibur_photon`). These are the weapons that carry a `windUpMs`
lockout, so the 315 charge-up telegraph already plays during their wind-up — this
sub-ticket makes the resulting impact feel proportionally heavy.

## Acceptance Criteria
- `steel_claymore`, `magma_greatsword`, and `excalibur_photon` are each
  registered in `CARD_RENDERERS` and resolve to a card-specific renderer (not
  the `renderConeSwings` type default).
- Each produces a distinct HEAVY slash differing by accent color and composition
  from the standard blades: a wide/large slash arc plus a pronounced impact —
  e.g. a larger-radius `spawnImpactDecal` and a high-`count` `spawnParticleBurst`
  (debris/sparks) at the impact point — so the hit reads as a big committed blow.
  Suggested palettes: Alloy Greatblade slate (`0x94a3b8`), Corebreaker magma
  (`0xf97316`/`0xff3b00`), Excalibur Photon magenta (`0xe879f9`).
- The three weapons differ from each other (color + at least one shape/impact
  parameter), and differ from the lighter blades in sub-tickets 01/02 by a
  heavier impact (e.g. larger decal radius or higher particle count).
- A test asserts these three cardIds carry a positive `windUpMs` (so the
  existing 315 charge telegraph fires for them) — read the merged card stats the
  client uses (`getCardDef` / `CARD_DEFS` / `cardStats.json`). This documents the
  "wind-up weapons show the charge telegraph" link without re-implementing the
  telegraph (which is rendered automatically in `renderer.js` from server
  `cardWindupUntil` state and is out of scope here).
- Each renderer adds only the unique slash/impact visual and still falls through
  to the uniform hit-flash / sound / shockwave post-effects in `renderCardUsed`.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert each of
  the three cardIds resolves to a card-specific renderer and that firing each
  through a recording ctx emits its distinct heavy-impact primitive calls.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs
- `game/client/cardRenderers.js`:
  - Add heavy-impact style entries to `WEAPON_SLASH_STYLES` (from sub-ticket 01)
    for the three greatswords, or a dedicated `renderHeavyGreatsword` helper that
    composes `ctx.spawnAttackEffect` (wide cone) + `ctx.spawnImpactDecal`
    (larger `radius`) + `ctx.spawnParticleBurst` (higher `count`/`spread`) at the
    impact point (use `pointAlong(origin, direction, range)`), guarded with
    `if (ctx.spawn...)`.
  - Register the three weapons under the `// Weapons` section of `CARD_RENDERERS`.
  - Honor `getAccentHex(data.cardId)` (`steel_claymore`, `excalibur_photon`,
    `magma_greatsword` all have accent entries) with a fallback color.
- `game/client/test/cardRenderers.test.js`: extend recording-ctx tests for the
  three cardIds, and add an assertion that each has `windUpMs > 0` via the
  client's card-def accessor.

## Verification: code
