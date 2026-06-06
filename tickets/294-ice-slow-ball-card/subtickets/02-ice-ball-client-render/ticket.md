# Ice Ball card: client slow-moving projectile render

Render the ice ball on the client. When the server emits a `CARD_USED` with
`effect: "ice_ball"`, draw a slow-moving icy sphere traveling from the caster
along the cast direction. Register the card in the client visual layer. Slow
status on hit enemies is already rendered via the 290 slow indicator driven by
broadcast `slowedUntil` — no new slow VFX is required here.

## Acceptance Criteria

- `game/client/renderer.js` handles `effect === "ice_ball"` in the attack-effect
  spawn path (alongside `"fireball"` / `"projectile"`, ~3994): spawns an icy
  sphere mesh at `origin` that travels along `direction` for `range`, using
  cool cyan/blue `color`/`emissive` distinct from the fireball palette.
- The ice ball animates **slower** than the default weapon projectile: use
  `projectileTravelMs` from the `CARD_USED` payload when present, otherwise a
  sensible default (e.g. `1200` ms), instead of `ATTACK_EFFECT_DURATION` (~600
  ms).
- The effect is registered in `activeEffects` with the same
  `origin`/`direction`/`range`/`duration` shape as existing traveling
  projectiles so per-frame movement and cleanup work normally.
- `game/client/cardRenderers.js` registers `ice_ball` with a renderer function
  that calls `spawnAttackEffect` with `effect: "ice_ball"` and passes through
  `attackRange` and `projectileTravelMs`.
- `game/client/cards.js` `CARD_ACCENT_STYLE.ice_ball` has an ice-themed color
  (e.g. `#67e8f9` / `#38bdf8`, consistent with `frost_nova`) and icon (e.g.
  `❄` or `🧊`).
- Client tests in `game/client/test/cardRenderers.test.js` and/or
  `game/client/test/cards.test.js` cover the new card id (renderer resolves,
  accent present) without regressing existing projectile branches.

## Technical Specs

- **`game/client/renderer.js`** — add `if (effect === 'ice_ball')` in
  `spawnAttackEffect` (~4018): `THREE.SphereGeometry` with cool ice
  `MeshStandardMaterial` (moderate `emissiveIntensity`), push to `activeEffects`
  with `duration: style.projectileTravelMs ?? 1200`. In the per-frame
  `updateAttackEffects` loop (~4603), ensure traveling spheres respect
  `fx.duration` (already the case for legacy projectiles).
- **`game/client/cardRenderers.js`** — add `renderIceBall(data, ctx)` (model on
  `renderFireball`) and register `ice_ball` in `CARD_RENDERERS`.
- **`game/client/cards.js`** — add `ice_ball` to `CARD_ACCENT_STYLE`.
- **`game/client/test/cardRenderers.test.js`** — assert `resolveRenderers('ice_ball')`
  returns a renderer and a spawn call produces `effect: 'ice_ball'` with the
  expected range/travel fields.
- Do **not** add a new slow indicator — reuse the existing `applySlowIndicator`
  path driven by `enemy.slowedUntil` in state updates.

## Verification: code
