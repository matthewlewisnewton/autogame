# Energy & photon blade slashes

Give the energy/photon-class weapons distinct slash visuals using the shared
weapon-slash helper and 315 primitives: Saber of Light (`saber_of_light`),
Photon Slicer (`photon_slicer`), Arcane Bolt (`arcane_bolt`), Resonance Edge
(`resonance_edge`), Phase Echo (`echo_blade`), and a trail/spark polish pass on
the existing Infinite Disk (`infinite_disk`) renderer.

## Acceptance Criteria
- `saber_of_light`, `photon_slicer`, `arcane_bolt`, `resonance_edge`, and
  `echo_blade` are each registered in `CARD_RENDERERS` and resolve to a
  card-specific renderer (not the `renderConeSwings` type default).
- Each of the five weapons produces a visually distinct slash differing by
  accent color AND at least one shape/composition parameter from the others —
  e.g. Saber of Light a radiant pale-gold arc, Photon Slicer a cyan spin slice,
  Arcane Bolt a violet energy lance, Resonance Edge a magenta resonant double
  pulse, Phase Echo a pink echoing twin-slash (a delayed second swing via
  `ctx.scheduleAfter`).
- Accent colors come from `getAccentHex` where the card has a `CARD_ACCENT_STYLE`
  entry (`saber_of_light`, `photon_slicer`, `arcane_bolt`, `resonance_edge`,
  `echo_blade` all do); the renderer supplies a fallback only if missing.
- `infinite_disk` keeps its three-disk fan but is enhanced with an accent
  `spawnProjectileTrail` and/or `spawnParticleBurst` along the disk path so it
  reads richer than before, while still spawning three offset projectiles.
- Each renderer adds only the unique slash visual and still falls through to the
  uniform hit-flash / sound / shockwave post-effects in `renderCardUsed`.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert each of
  the five new cardIds resolves to a card-specific renderer and that firing each
  through a recording ctx emits its distinct primitive calls / colors (and that
  Phase Echo schedules a delayed second swing).
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs
- `game/client/cardRenderers.js`:
  - Reuse the `renderWeaponSwing` helper + `WEAPON_SLASH_STYLES` table from
    sub-ticket 01 (add style entries for the five energy weapons). If a card
    needs bespoke timing (Phase Echo's echo, Resonance Edge's double pulse),
    add a small dedicated renderer that composes the same primitives plus
    `ctx.scheduleAfter(delayMs, () => ...)`.
  - Register the five weapons under the `// Weapons` section of `CARD_RENDERERS`.
  - Update `renderTripleReturning` (the `infinite_disk` renderer) to also call
    `ctx.spawnProjectileTrail` and/or `ctx.spawnParticleBurst` with the existing
    cyan disk style (`0xa5f3fc` / `0x22d3ee`), guarded by `if (ctx.spawn...)`.
  - Honor `getAccentHex(data.cardId)` for the slash color of accented cards.
- `game/client/test/cardRenderers.test.js`: extend recording-ctx tests to cover
  the five new weapon cardIds and the enhanced `infinite_disk` path.

## Verification: code
