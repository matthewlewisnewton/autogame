# Arcane Bolt projectile mesh visual

Add a dedicated `arcane_bolt` branch to `spawnAttackEffect` in `renderer.js` so the traveling bolt reads unmistakably as a violet arcane energy lance — not the generic `projectile` sphere or a melee cone wedge. This primitive is the visual foundation for the cast/trail/impact polish in sub-ticket 02.

## Acceptance Criteria

- `spawnAttackEffect(origin, direction, { effect: 'arcane_bolt', range, color, emissive, projectileTravelMs })` in `game/client/renderer.js` creates a visible elongated arcane bolt mesh (e.g. tapered cylinder or narrow cone oriented along `direction`) with violet palette (`#a78bfa` / `#7c3aed` family), not a small generic sphere or ground cone wedge.
- The bolt honors `style.color`, `style.emissive`, `style.range`, and `style.projectileTravelMs` passed from the card renderer; duration defaults to `ATTACK_EFFECT_DURATION` (600 ms) when `projectileTravelMs` is absent.
- The effect travels `range` world units along `direction` over its duration, using the same position-interpolation / cleanup path as `fireball` and `ice_ball` projectile effects.
- `updateAttackEffects` gives the arcane bolt a subtle alive motion during flight (e.g. emissive pulse or slight scale oscillation) via a dedicated flag on the `activeEffects` entry — no per-frame geometry allocation.
- Existing `projectile`, `throw_rock`, `fireball`, `ice_ball`, and `returning_projectile` branches are unchanged.
- `pnpm test:quick` still passes.

## Technical Specs

- `game/client/renderer.js`:
  - Add an `if (effect === 'arcane_bolt')` branch near the other projectile effects (~lines 4228–4300): build a grouped mesh (elongated bolt core + optional trailing glow) with violet `MeshStandardMaterial` settings; push to `activeEffects` with `{ mesh, origin, direction, range, createdAt, duration: style.projectileTravelMs ?? ATTACK_EFFECT_DURATION, isArcaneBoltProjectile: true }` (or equivalent flag).
  - In `updateAttackEffects()`, add a branch before the legacy projectile path that animates `isArcaneBoltProjectile` entries (pulse/flicker while traveling along the existing `origin`→`range` interpolation).
- Import/use `ATTACK_EFFECT_DURATION` from `./config.js` if not already in scope for the default duration fallback.
- Do **not** modify `cardRenderers.js` or server code in this sub-ticket.

## Verification: code
