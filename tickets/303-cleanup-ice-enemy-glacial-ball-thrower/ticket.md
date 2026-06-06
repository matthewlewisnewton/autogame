# Cleanup nits from 293-ice-enemy-glacial-ball-thrower

> **Staleness note.** This follow-up ticket was written against commit
> `e1d25a02` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `293-ice-enemy-glacial-ball-thrower`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Tag Glacial Ice Balls as Projectile Damage

Glacial thrower ice balls are modeled and described as ranged projectiles, but their contact damage calls `damagePlayer()` without `projectile` or `ranged` metadata. This means existing projectile-aware defenses such as Barrier Dome do not recognize them as projectile hits; it is not part of the current ticket acceptance criteria, but aligning the metadata would keep future combat interactions consistent.

### Acceptance Criteria
- Ice-ball contact damage passes projectile/ranged metadata, including enough attacker position data for existing defensive checks.
- Slow application is coordinated with blocked or fully avoided hits so defensive mechanics do not leave inconsistent “no damage but still slowed” outcomes unless intentionally documented.
