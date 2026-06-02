# Render the equipped hat on the avatar

Building on the cosmetic-driven avatar group, render the player's equipped `hat`
cosmetic as a child mesh sitting above the avatar's head. Each catalog hat
(`cap`, `wizard`, `crown`) gets a distinct, recognizable shape; `none` renders no
hat. The hat updates when the player's cosmetic changes.

## Acceptance Criteria
- `createPlayerAvatar` (from sub-ticket 01) adds a hat child mesh above the body
  based on `cosmetic.hat`, mapping the catalog ids: `none` → no hat mesh at all,
  `cap` → a low cap shape, `wizard` → a tall cone, `crown` → a gold crown shape
  (e.g. torus/ring or notched cylinder). An unknown/missing `hat` renders no hat.
- Each hat is positioned at the top of the body so it reads as worn on the head,
  regardless of which `bodyShape` is selected, and rotates with the avatar group.
- The `crown` hat uses a gold-toned color; the other hats are visually
  distinguishable from one another and from the body.
- Because the avatar rebuilds on cosmetic change (sub-ticket 01), switching the
  `hat` field produces the new hat without a page reload; the hat's child
  geometry/material are disposed with the rest of the group on rebuild (no leaked
  meshes).
- The hat applies to both the local player and remote players, and the browser
  smoke run shows no new console errors.

## Technical Specs
- `game/client/renderer.js`:
  - In `createPlayerAvatar`, after building the body, branch on `cosmetic.hat` and
    append a hat child mesh to the group (skip entirely for `none`/unknown).
    Suggested geometries: `cap` → short `CylinderGeometry` (optionally with a thin
    brim), `wizard` → `ConeGeometry`, `crown` → `TorusGeometry` or a notched
    `CylinderGeometry` in a gold color.
  - Position the hat above the body's top (account for body height) and add it as a
    child so it inherits the group's rotation.
  - Ensure the cosmetic signature used for change-detection in sub-ticket 01
    includes the `hat` field so equipping/removing a hat triggers a rebuild.
- Use the catalog hat ids defined server-side in `game/server/cosmetic.js`
  (`HAT_CATALOG`: `none`, `cap`, `wizard`, `crown`) — do not invent new ids.

## Verification: code
