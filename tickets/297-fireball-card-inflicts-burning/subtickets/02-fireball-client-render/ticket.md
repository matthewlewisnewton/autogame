# Fireball card: client projectile render + card visual

Render the fireball on the client. When the server emits a `CARD_USED` with
`effect: "fireball"`, draw a fiery projectile travelling from the caster, and
give the new card its own visual in the card UI. The burning flame on hit
enemies is already rendered (291) via the broadcast `burningUntil`, so no new
burning visual is needed.

## Acceptance Criteria
- `client/renderer.js` handles `effect === "fireball"` in the card-effect
  rendering path (alongside the existing `"throw_rock"` / `"projectile"`
  branches, ~line 3994): it spawns a fiery sphere projectile that travels from
  `origin` along `direction` for `range`, distinct from the plain `projectile`
  visual (warm fire colors — e.g. orange/red `color`/`emissive`).
- The fireball projectile is registered in `activeEffects` with the same
  `origin`/`direction`/`range`/`duration` shape as the existing `projectile`
  effect so it animates and is cleaned up normally.
- The new card id is given a visual in the card UI so it renders as a real card
  (icon/label) rather than a fallback — handled in `client/cardRenderers.js`
  and/or `client/cards.js` consistent with how other fire cards (e.g.
  `arcane_bolt`, `dragons_breath`) are presented.
- No regression to existing projectile rendering: the `"projectile"` and
  `"returning_projectile"` branches are unchanged.

## Technical Specs
- `game/client/renderer.js` — add a `if (effect === "fireball")` block in the
  same function that contains the `throw_rock` / `projectile` / `returning_*`
  branches (~lines 3951–4030). Build a `THREE.SphereGeometry` mesh with
  fire-colored `MeshStandardMaterial` (high `emissiveIntensity`), position at
  `origin` (y≈1.0), add to `targetScene`, and push to `activeEffects` with
  `{ mesh, origin, direction, range, createdAt, duration: ATTACK_EFFECT_DURATION }`.
- `game/client/cardRenderers.js` and/or `game/client/cards.js` — register the
  new card id's display (icon/art/label) following the existing per-card
  pattern.
- Burning-on-enemy visuals already exist (`enemyBurnMarkers`, driven by
  `burningUntil` in state) — do NOT add a new burning visual.

## Verification: code
