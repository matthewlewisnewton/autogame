# Cleanup nits from 341-anim-infinite-disk

> **Staleness note.** This follow-up ticket was written against commit
> `66068555` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `341-anim-infinite-disk`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
