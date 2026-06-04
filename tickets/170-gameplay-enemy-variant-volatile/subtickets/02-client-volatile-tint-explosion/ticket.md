# Client: Volatile tint/badge + explosion visual

Give the `volatile` enemy variant a distinct on-screen identity (a tint/badge
color separate from the generic variant marker) and render the radial explosion
when the server emits `volatileExplosion` on a volatile enemy's death.

## Acceptance Criteria

- A `volatile`-tagged enemy is visually distinguished from both plain enemies
  and other (e.g. `test`) variants: `applyVariantMarker` in
  `game/client/renderer.js` selects a distinct color for `enemy.variant ===
  'volatile'` (a volatile-specific badge tint, and/or an enemy mesh tint),
  while non-volatile variants keep the existing marker color.
- The client listens for the `volatileExplosion` socket event and renders a
  visible expanding radial blast (a ground ring / AoE burst) centered on the
  event's `(x, z)` and sized to its `radius`, using the existing effect-ring
  rendering path.
- The explosion visual is tinted to read as a hostile detonation (a warm/red
  volatile color), distinct from existing friendly summon/inferno effects.
- The blast effect is transient: it expands and fades on its own without
  leaving a persistent mesh, and disposes cleanly (reusing the existing
  `activeEffects` lifecycle in `updateAttackEffects`).
- No regressions to existing variant marker behavior: a reused enemy id that
  loses its variant still has its badge removed.

## Technical Specs

- `game/client/renderer.js`: add a `spawnVolatileExplosionEffect(origin,
  radius)` (modeled on `spawnSummonEffect`/`spawnInfernoPillarEffect`, pushing
  to `activeEffects` so `updateAttackEffects` animates+disposes it) with a
  volatile color; extend `applyVariantMarker` (around line 2674) so
  `enemy.variant === 'volatile'` uses a distinct marker color constant (and/or
  tints the enemy mesh) versus the existing `VARIANT_MARKER_COLOR`.
- `game/client/main.js`: import/expose the new renderer function (alongside
  `spawnInfernoPillarEffect` at lines ~127 and ~792) and add a
  `s.on('volatileExplosion', (data) => { ... })` handler (near the other
  `s.on(...)` handlers, ~line 1099) that guards on `getScene()` and calls the
  renderer with `data.x/data.z` and `data.radius`.
- Depends on sub-ticket 01 having defined the `volatileExplosion` event payload
  (`{ x, z, radius }`) and the `volatile` variant id.

## Verification: code
