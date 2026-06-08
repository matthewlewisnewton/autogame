# Fireball projectile mesh visual

Upgrade the traveling Fireball projectile mesh in `renderer.js` so it reads unmistakably as a fiery orb — not a generic `projectile` rock or the cool-toned `ice_ball` sphere. This is the foundation for the cast/trail/impact polish in sub-ticket 02.

## Acceptance Criteria

- `renderer.js` `effect === 'fireball'` branch builds a fire-themed projectile that is visually distinct from both `projectile`/`throw_rock` and `ice_ball`: warm orange/red palette (`color`/`emissive` from `style`), higher emissive intensity, and a layered or enlarged silhouette (e.g. ember core + outer flame shell, or a slightly larger sphere with a trailing glow group).
- The fireball mesh honors `style.color`, `style.emissive`, and `style.projectileTravelMs` passed from `spawnAttackEffect` (sub-ticket 02 will wire travel duration; this branch must accept it the same way `ice_ball` does).
- `updateAttackEffects` gives the fireball a subtle alive motion during flight (e.g. scale/opacity pulse or emissive flicker) via a dedicated flag on the `activeEffects` entry — no per-frame geometry allocation.
- Existing `projectile`, `throw_rock`, `ice_ball`, and `returning_projectile` branches are unchanged.
- `pnpm test:quick` still passes.

## Technical Specs

- `game/client/renderer.js`:
  - Enhance the `if (effect === 'fireball')` block (~lines 4199–4224): build a grouped mesh (core sphere + optional outer halo) with fire `MeshStandardMaterial` settings; push to `activeEffects` with `{ mesh, origin, direction, range, createdAt, duration: style.projectileTravelMs ?? ATTACK_EFFECT_DURATION, isFireballProjectile: true }` (or equivalent flag).
  - In `updateAttackEffects()`, add a branch before the legacy projectile path that animates `isFireballProjectile` entries (pulse/flicker while traveling along the existing `origin`→`range` interpolation).
- Import/use `ATTACK_EFFECT_DURATION` from `./config.js` if not already in scope for the default duration fallback.
- Do **not** modify `cardRenderers.js` or server code in this sub-ticket.

## Verification: code
