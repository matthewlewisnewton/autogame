# Render avatar body shape and colors from the cosmetic profile

The server already broadcasts each player's `cosmetic` ({ bodyColor, accentColor,
bodyShape, hat }) inside the per-player game state. The client currently ignores
it and draws every player as a hardcoded 1×1×1 blue/red box. Replace that with a
cosmetic-driven avatar: the body uses the chosen `bodyShape` geometry and
`bodyColor`, with a small accent element tinted by `accentColor`. This applies to
both the local player and remote players, and the avatar rebuilds when a player's
cosmetic changes.

## Acceptance Criteria
- A builder function in `client/renderer.js` constructs a player avatar as a
  `THREE.Group` from a cosmetic object, choosing the body geometry by
  `bodyShape`: `box`→BoxGeometry, `cylinder`→CylinderGeometry, `cone`→ConeGeometry,
  `capsule`→CapsuleGeometry. An unknown/missing `bodyShape` falls back to `box`.
- The body mesh material color is set from `cosmetic.bodyColor`; a distinct accent
  child element (e.g. a band/stripe) is colored from `cosmetic.accentColor`. A
  missing/invalid cosmetic falls back to the default body color rather than crashing.
- Both the local player (`myId`) and every remote player are rendered with this
  builder; the old hardcoded `new THREE.BoxGeometry(1,1,1)` / blue-vs-red color
  block is removed.
- The avatar is rebuilt (old meshes disposed and removed from the scene) when a
  player's broadcast cosmetic differs from the one currently rendered (tracked via
  a cosmetic signature stored on the group, e.g. `group.userData`).
- The existing per-player visual states still work against the new group:
  dead players still gray out, the local player's i-frame transparency still
  applies, and the remote-player HP-drop flash (`flashMesh`) still fires — all
  targeting the avatar's body mesh rather than assuming the player object is a bare
  Mesh.
- Dash squash/stretch (`triggerDashVFX`) and shield VFX (`triggerShieldVFX`) still
  function with the group-based avatar (no `mesh.material`/`mesh.geometry`
  undefined errors); the browser smoke run shows no new console errors.

## Technical Specs
- `game/client/renderer.js`:
  - Add `createPlayerAvatar(cosmetic, isSelf)` returning a `THREE.Group`. Build the
    body child mesh (~1 unit tall) with a `MeshStandardMaterial` colored from
    `bodyColor`, plus an accent child mesh colored from `accentColor`. Store a
    reference to the body mesh (e.g. `group.userData.bodyMesh`) and a cosmetic
    signature string (e.g. `group.userData.cosmeticKey`) for change detection.
  - In the per-frame player loop (around line 2691–2719 and the local-player block
    around 2721–2767), replace the inline box creation with `createPlayerAvatar`,
    and where the code currently does `playersMeshes[id].material.color.setHex(...)`
    / `.material.transparent` / `flashMesh(playersMeshes[id], ...)`, retarget those
    to `playersMeshes[id].userData.bodyMesh`. Base alive color comes from
    `bodyColor`; keep dead=gray (0x808080) and the HP-flash behavior.
  - When `pData.cosmetic`'s signature differs from `userData.cosmeticKey`, dispose
    the old group's child geometries/materials, `scene.remove` it, and rebuild.
  - Update `flashMesh`, `triggerDashVFX`, and `triggerShieldVFX` so they resolve the
    body mesh from a group (e.g. via `userData.bodyMesh`) when passed an avatar,
    while still working if passed a bare mesh.
- Reuse the body-shape vocabulary from the server's `BODY_SHAPES`
  (`box`/`cylinder`/`cone`/`capsule`) in `game/server/cosmetic.js` — do not invent
  new shape names.

## Verification: code
