## Gravity Well inflow particles drift outward instead of inward

In `spawnGravityWellEffect`, each inflow particle is spawned at its outer ring
position `(px, py, pz)` with a velocity pointing inward toward the center. But
`updateAttackEffects` sets `particle.position.set(v.x * t, v.y * t, v.z * t)`
(game/client/renderer.js, `isGravityWellInflow` branch), which ignores the spawn
position — at t≈0 the particle snaps to the well center and then streaks OUTWARD
to the opposite side (and slightly below ground as `v.y` is negative). The intent
is an inward inflow ("pull"). The unit test only checks spawn-time
position/velocity alignment, not the runtime trajectory, so the regression is
not caught. Visually minor (10 tiny brief particles; the contracting ring and
void core dominate), but the streaks currently read backwards.

### Acceptance Criteria
- Inflow particles visibly travel from the outer pull radius toward the well
  center over their lifetime (e.g. `position = spawnPos * (1 - t)` or
  `spawnPos + velocity * t` with velocity sized to land at center at t=1).
- Particles do not sink below the ground plane during the motion.
- A test asserts the particle is farther from the center at t=0 than near the
  end of life (monotonic inward travel).
