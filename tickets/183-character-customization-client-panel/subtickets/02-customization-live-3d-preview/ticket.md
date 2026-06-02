# Customization Panel — Live 3D Avatar Preview

Add a small live 3D preview of the avatar to the Character customization
section built in sub-ticket 01, so the player sees their `bodyColor`,
`accentColor`, and `bodyShape` choices reflected before saving. Reuse the
renderer's existing `createPlayerAvatar` so the preview matches the in-run
avatar exactly.

## Acceptance Criteria
- The Character section contains a dedicated preview canvas/element showing a
  rendered avatar built from the current (unsaved) selection.
- The preview is built from the same `createPlayerAvatar(cosmetic, isSelf)`
  export in `game/client/renderer.js` that the in-run avatar uses, so the
  body shape, body color, and accent band all match what appears in a run.
- Changing any of the three controls (body color, accent color, body shape)
  updates the preview to reflect the new selection without requiring a Save or
  a page reload.
- Opening the panel initializes the preview from the currently cached cosmetic
  (`getAccountCosmetic()`); the preview's own Three.js resources (renderer,
  geometries, materials) are created when the panel opens and disposed/stopped
  when it closes, so repeated open/close does not leak meshes or run an
  animation loop while the panel is hidden.
- The preview is self-contained (its own mini scene/camera) and does not
  disturb the main game scene, camera, or render loop.

## Technical Specs
- `game/client/index.html`: add a `<canvas id="cosmetic-preview-canvas">` (or a
  container the preview mounts into) inside the Character `settings-section`
  added in sub-ticket 01.
- `game/client/main.js` (or a small new helper module, e.g.
  `game/client/cosmetic-preview.js`): create a dedicated `THREE.Scene`,
  `PerspectiveCamera`, and `WebGLRenderer` bound to the preview canvas, add a
  light, mount `createPlayerAvatar(getAccountCosmetic-or-current-selection,
  true)`, and render. Provide an `updatePreview(cosmetic)` that disposes the
  old avatar group (use the existing avatar dispose helper / `traverse`) and
  mounts a freshly built one, called from the sub-ticket 01 control handlers.
  Start the preview render on `openAccountOverlay` and tear it down on
  `closeAccountOverlay`.
- Import `createPlayerAvatar` (already exported from `renderer.js`); do not
  duplicate avatar-building geometry/material logic.

## Verification: code
