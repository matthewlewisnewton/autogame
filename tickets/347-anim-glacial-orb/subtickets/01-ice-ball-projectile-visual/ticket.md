# Glacial Orb projectile mesh visual

Upgrade the traveling `ice_ball` projectile mesh in `renderer.js` so it reads unmistakably as a **Glacial Orb** — a crystalline frost sphere — not a generic `projectile` rock or the warm `fireball` ember shell. This is the visual foundation for the cast/trail/impact polish in sub-ticket 02.

## Acceptance Criteria

- `renderer.js` `effect === 'ice_ball'` branch builds a glacial-themed projectile that is visually distinct from `projectile`/`throw_rock`, `fireball`, and `permafrost_lance`: cool cyan/ice palette (`style.color` / `style.emissive`, `#67e8f9` / `#38bdf8` family), layered silhouette (e.g. faceted or crystalline core + outer frost halo), and higher emissive intensity than the current plain sphere.
- The glacial orb mesh honors `style.color`, `style.emissive`, and `style.projectileTravelMs` passed from `spawnAttackEffect` (sub-ticket 02 wires travel duration; this branch must accept it the same way `fireball` does).
- `updateAttackEffects` gives the glacial orb subtle alive motion during flight (e.g. scale pulse, emissive shimmer, or slow rotation) via a dedicated flag on the `activeEffects` entry — no per-frame geometry allocation.
- Existing `projectile`, `throw_rock`, `fireball`, `permafrost_lance`, and `returning_projectile` branches are unchanged.
- `pnpm test:quick` still passes.

## Technical Specs

- `game/client/renderer.js`:
  - Enhance the `if (effect === 'ice_ball')` block (~lines 4303–4328): build a grouped mesh (crystalline core + optional frost halo) with icy `MeshStandardMaterial` settings; push to `activeEffects` with `{ mesh, coreMesh?, haloMesh?, origin, direction, range, createdAt, duration: style.projectileTravelMs ?? 1200, isGlacialOrbProjectile: true }` (or equivalent flag).
  - In `updateAttackEffects()`, add a branch before the legacy projectile path that animates `isGlacialOrbProjectile` entries (pulse/shimmer/rotation while traveling along the existing `origin`→`range` interpolation), mirroring the `isFireballProjectile` pattern (~lines 6379–6409).
- Import/use `ATTACK_EFFECT_DURATION` from `./config.js` only if needed for a fallback comment; default duration for `ice_ball` is **1200 ms** (from `cardStats.json`), not 600 ms.
- Do **not** modify `cardRenderers.js` or server code in this sub-ticket.

## Verification: code
