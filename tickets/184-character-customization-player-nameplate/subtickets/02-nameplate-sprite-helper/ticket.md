# Nameplate sprite helper and registry

Add a `createNameplate()` function that renders a player's username as a canvas-texture sprite, plus a `playerNameplates` registry and `disposeNameplate()` for lifecycle management.

## Acceptance Criteria
- A `createNameplate(username)` function exists in `renderer.js` that returns a `THREE.Sprite` with a canvas-drawn text label showing the given username.
- The sprite uses a `CanvasTexture` with a dark text color and semi-transparent background for readability against any scene background.
- The sprite is sized to be clearly readable at typical dungeon camera distances (~2–8 units away).
- A module-scoped `playerNameplates` object (map from player ID to sprite) is declared in `renderer.js`.
- A `disposeNameplate(playerId)` function removes the sprite from the scene, disposes its texture/material, and deletes the entry from `playerNameplates`.
- `createNameplate` is exported so it can be called from the game loop in sub-ticket 03.

## Technical Specs
- `game/client/renderer.js`:
  - Declare `const playerNameplates = {}` near the existing `playersMeshes` registry (~line 95).
  - Add `export function createNameplate(username)` that:
    - Creates a 512×128 canvas, draws a rounded-rect background (semi-transparent dark fill, e.g. `rgba(0,0,0,0.55)`) and centered text (`username`, bold, ~48px, white).
    - Creates a `THREE.CanvasTexture(canvas)`, sets `minFilter = THREE.LinearFilter`.
    - Creates a `THREE.SpriteMaterial({ map, transparent: true, depthTest: false })`.
    - Creates a `THREE.Sprite(material)` with scale ~`1.2, 0.3, 1` and returns it.
  - Add `export function disposeNameplate(playerId)` that:
    - Looks up `playerNameplates[playerId]`, if present: removes from scene, disposes material map texture and material, deletes registry entry.
  - Follow the styling of `spawnDamageNumber()` for text appearance (bold, text-shadow equivalent via canvas `shadowColor`/`shadowBlur`).

## Verification: code
