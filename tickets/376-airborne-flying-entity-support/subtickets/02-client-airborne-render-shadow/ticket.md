# Client airborne render + ground shadow

Render airborne entities at their server altitude instead of pinned to the
ground, and draw a ground shadow beneath each flier so its position on the floor
stays readable. Applies symmetrically to flying enemies and flying minions;
grounded entities render exactly as before.

## Acceptance Criteria
- In the enemy mesh sync, when an enemy is flying (`enemy.flying`, using the
  server-authoritative `enemy.y` for altitude), its mesh is positioned at the
  flying height (mesh base raised by the entity's altitude) rather than the
  fixed ground half-height. Non-flying enemies keep their current
  `position.set(enemy.x, halfHeight, enemy.z)` placement unchanged.
- The same airborne placement is applied in the minion mesh sync for flying
  minions (e.g. `storm_eagle`, `thunderbird`); non-flying minions unchanged.
- A ground shadow (a flat circular/elliptical decal near floor level, e.g. at
  `GROUND_OVERLAY_Y`) is created and positioned directly beneath each flying
  entity at `(entity.x, entity.z)` and follows it each frame.
- Shadows exist ONLY for flying entities (no shadow added for grounded ones) and
  are removed/disposed when the flying entity despawns, mirroring the existing
  enemy/minion mesh cleanup so no orphan shadow meshes leak.
- Health bars and shield bars for a flying enemy follow it to altitude (their Y
  offset is computed from the flier's render height, not the ground half-height),
  so they sit above the airborne body.
- Existing client tests / smoke tests still pass; grounded enemies and minions
  are visually and structurally unchanged.

## Technical Specs
- `game/client/renderer.js`:
  - Enemy mesh sync (~line 6448): compute a render Y that adds the flier's
    altitude when `enemy.flying` (derive from `enemy.y`/`enemy.altitude`),
    otherwise keep `halfHeight`. Apply to the enemy mesh and offset the health/
    shield bar positions accordingly.
  - Minion mesh sync (~line 6674): same airborne-vs-ground render-Y logic.
  - Add a shadow mesh factory (flat disc/ring lying in the XZ plane) and a
    `Map`/object keyed by entity id for flying-entity shadows; create on demand
    for flying entities, update position each frame, dispose alongside the
    entity's mesh in the existing despawn cleanup paths (use `GROUND_OVERLAY_Y`
    for the shadow's Y like other ground overlays).
- Do NOT change server code; rely on `flying`/`altitude`/`y` fields shipped by
  sub-ticket 01 (already serialized via `buildWorldSnapshot`).

## Verification: code
