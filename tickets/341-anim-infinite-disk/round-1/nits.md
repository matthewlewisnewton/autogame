## Infinite Disk return beats are window-paced, not per-pass-timed
The boomerang return beats fire at a fixed `ATTACK_EFFECT_DURATION/3` cadence, while the
server resolves all return passes on the same tick. This is fine as a cosmetic flourish, but
if the server ever staggers returning-projectile hits across ticks, the client beats should be
re-derived from per-pass hit timestamps so the flourish lines up with each actual hit.

### Acceptance Criteria
- If/when server returning-projectile resolution becomes multi-tick, the client return beats
  for `infinite_disk` derive their timing from the payload's per-pass hit data rather than a
  fixed `ATTACK_EFFECT_DURATION/3` cadence.
- Single-tick resolution continues to render the current quick flourish unchanged.
