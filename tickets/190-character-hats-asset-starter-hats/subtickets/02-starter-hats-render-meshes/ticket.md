# Starter hats: render meshes for the new free starter hats

The new free starter hats `bandana` and `beanie` (added to the server catalog in
sub-ticket 01) have no avatar geometry, so an account that equips them would
render bare-headed. Add distinct, recognizable procedural meshes for both so the
equipped hat shows on the player avatar (in-run and in the cosmetic preview).

## Acceptance Criteria
- `AVATAR_HAT_IDS` in `game/client/renderer.js` includes `bandana` and `beanie`
  in addition to the existing `none`, `cap`, `wizard`, `crown`. It stays in sync
  with the server `HAT_CATALOG`.
- `buildHatMesh('bandana')` returns a non-null `THREE.Object3D` whose base sits
  at the group origin (so it seats correctly when positioned at `bodyTopY`), and
  it is visually distinct from the existing cap/wizard/crown (different shape and
  color).
- `buildHatMesh('beanie')` returns a non-null `THREE.Object3D` with the same
  seating convention, visually distinct from every other hat.
- `buildHatMesh` still returns `null` for `none` and any unknown id, and the
  `cap`/`wizard`/`crown` cases are unchanged.
- `cosmeticSignature` produces a distinct signature for `bandana` and `beanie`
  (this follows automatically from adding them to `AVATAR_HAT_IDS`), so avatars
  rebuild correctly when those hats are equipped.
- Equipping `bandana` or `beanie` via the cosmetic preview / in-run avatar
  produces a visible hat mesh on top of the body for every body shape (the hat is
  added as a child positioned at `bodyTopY(shape)` exactly like the existing
  hats).
- `pnpm test` (from `game/`) passes.

## Technical Specs
- `game/client/renderer.js`:
  - Add `'bandana'` and `'beanie'` to the `AVATAR_HAT_IDS` set.
  - Add two distinct color constants near the existing `HAT_CAP_COLOR` /
    `HAT_WIZARD_COLOR` / `HAT_CROWN_COLOR` (e.g. `HAT_BANDANA_COLOR` red,
    `HAT_BEANIE_COLOR` slate/teal) — choose hues distinct from the body/accent
    defaults and from the other hats.
  - Add `case 'bandana'` and `case 'beanie'` to `buildHatMesh`, following the
    existing pattern (base at origin; the caller sets `hat.position.y =
    bodyTopY(shape)`). Suggested geometry: `bandana` = a thin flat band/torus
    hugging the head (similar seating to `crown` but lower-profile and not gold);
    `beanie` = a small snug dome (e.g. a low half-sphere via `SphereGeometry`
    with a clipped phi range, or a short rounded cylinder) sitting just above the
    head. Use `MeshStandardMaterial`.
  - Do not change `bodyTopY`, `buildBodyGeometry`, `createPlayerAvatar` seating
    logic, or `disposeAvatar`; the new hats must dispose cleanly through the
    existing traversal.
- This depends on sub-ticket 01 having added the matching server catalog ids; the
  two id sets must agree.

## Verification: code
