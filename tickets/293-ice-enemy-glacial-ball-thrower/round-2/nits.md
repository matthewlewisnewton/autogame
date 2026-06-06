## Tag Glacial Ice Balls as Projectile Damage

Glacial thrower ice balls are modeled and described as ranged projectiles, but their contact damage calls `damagePlayer()` without `projectile` or `ranged` metadata. This means existing projectile-aware defenses such as Barrier Dome do not recognize them as projectile hits; it is not part of the current ticket acceptance criteria, but aligning the metadata would keep future combat interactions consistent.

### Acceptance Criteria
- Ice-ball contact damage passes projectile/ranged metadata, including enough attacker position data for existing defensive checks.
- Slow application is coordinated with blocked or fully avoided hits so defensive mechanics do not leave inconsistent “no damage but still slowed” outcomes unless intentionally documented.
