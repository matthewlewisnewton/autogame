## Glacial Orb core fades to near-invisible right at impact
In `updateAttackEffects` the core opacity is driven by `lifeRatio` (`0.92 * (1 - t)`),
so the crystalline core is almost fully transparent exactly when it reaches the target
and the deferred terminal frost burst fires. The orb can read as "dissolving away"
just before impact rather than landing solidly. Consider holding more core opacity in
the final stretch (e.g. ease the fade only over the last ~15% of travel) so the orb is
still clearly visible at the moment of impact.
### Acceptance Criteria
- The glacial orb core remains clearly visible (opacity noticeably above ~0) at `t≈1`,
  i.e. as it reaches the impact point.
- The terminal impact burst still coincides with the orb's visual arrival.

## Per-enemy frost bursts fire at cast while the orb is still visually in flight
The per-hit frost bursts/hit-sparks are spawned synchronously in `renderIceBall`
(matching the server's instant damage), but the orb visibly travels for
`projectileTravelMs`. Enemies can appear to "freeze" before the orb reaches them.
This is defensible (server resolution is instant), but if a tighter visual read is
wanted, consider whether the per-enemy frost reaction should be lightly staggered
toward the projectile's arrival without desyncing from the authoritative hit.
### Acceptance Criteria
- Per-enemy frost reactions read as caused by the orb's arrival rather than preceding
  it, while still reflecting the server's instant damage/slow.
