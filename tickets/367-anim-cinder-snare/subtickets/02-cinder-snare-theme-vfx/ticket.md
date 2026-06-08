# Cinder Snare theme VFX composition

Extend `renderCinderSnare` so the placement cast reads unmistakably as a
smoldering fire **snare** — not a recolored Spike Trap. Compose additional 315
primitives into the ground-placement burst so the visual identity matches the
card name (cinder embers + entrapment ring) and the enchantment's inferno DoT
lineage.

## Acceptance Criteria

- `renderCinderSnare` calls `ctx.spawnTelegraphRing` at `originOf(data)` with
  `data.radius` (2.5) using the cinder/fire palette (`0xf97316` / `0xff3b00`).
- `renderCinderSnare` calls `ctx.spawnParticleBurst` at the placement origin
  configured as an ember/coal shower (suggested: `count` ≥ 12, `spread` ≥ 2.0)
  with the same cinder palette.
- `renderCinderSnare` calls `ctx.spawnImpactDecal` at the placement origin for a
  lingering ground scorch mark (cinder palette).
- The primitive mix differs from `spike_trap` / `renderGroundEnchantment`: Cinder
  Snare must use `spawnTelegraphRing`, `spawnParticleBurst`, and
  `spawnImpactDecal`; Spike Trap must remain a single `spawnSummonEffect` with
  hostile red (`0xf87171`).
- All new primitive calls are guarded (`if (ctx.spawn…)`) so the renderer
  degrades gracefully when a primitive is absent.
- `renderCardUsed` post-effects (hit flash, sound, generic enchantment trigger
  ring) are unchanged; this renderer only adds the card-unique visuals.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert
  `cinder_snare` emits `spawnTelegraphRing`, `spawnParticleBurst`, and
  `spawnImpactDecal` with cinder colors.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs

- `game/client/cardRenderers.js`:
  - In `renderCinderSnare`, compose on placement (t = 0):
    - `ctx.spawnTelegraphRing(origin, data.radius, { color, emissive })` — the
      snare radius ring
    - `ctx.spawnParticleBurst(origin, { color, emissive, count, spread })` —
      rising ember/coal particles
    - `ctx.spawnImpactDecal(origin, { color, emissive })` — scorched ground mark
    - Keep any summon ring from sub-ticket 01 only if it does not duplicate the
      telegraph ring; prefer telegraph + burst + decal as the primary stack.
  - Do not modify `renderGroundEnchantment`, `spike_trap`, or any other card's
    renderer registration.
- `game/client/test/cardRenderers.test.js`:
  - Extend the `cinder_snare` recording-ctx test to assert telegraph ring,
    particle burst, and impact decal primitive calls and cinder palette values.
  - Add a test that `spike_trap` does **not** emit `spawnTelegraphRing`,
    `spawnParticleBurst`, or `spawnImpactDecal` (documents the visual
    distinction).

## Verification: code
