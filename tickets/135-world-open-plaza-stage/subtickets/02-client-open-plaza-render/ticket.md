# Client: render Open Plaza cover pieces and platforms

Make the client draw the open-plaza arena: render each `cover` entry as a box
mesh (pillar = tall box, broken wall = low box) sitting on the floor, render the
`platforms` as gently sloped raised floor patches, and add cover pieces to the
client-side wall colliders so client prediction matches the server.

## Acceptance Criteria

- In `buildDungeon()`, every entry in `layout.cover` produces a box mesh:
  - `type: 'pillar'` → a tall box (`THREE.BoxGeometry(width, height, depth)`)
    reusing `wallMaterial`,
  - `type: 'broken_wall'` → a low box of the same form with its smaller height,
  - each box is centered at the cover piece's `(x, z)` and rests on the floor:
    its base sits at `sampleFloorY(layout, x, z)` (so a cover piece on a platform
    sits on the raised surface), with the box centered at
    `floorY + height / 2`.
- Every entry in `layout.platforms` renders as a raised floor patch using the
  existing sloped-floor builder so the ~0.5-unit rise reads as a subtle slope,
  not a step. (Reuse `buildSlopedFloor` / the same geometry path used for sloped
  rooms.)
- `buildWallColliders()` (client, in `game/client/dungeon.js`) pushes an AABB for
  every `layout.cover` entry, matching the server's footprint, so client-side
  movement prediction stops the player at cover pieces.
- All new rendering is guarded so existing room/passage layouts (no `cover`,
  no `platforms`) render exactly as before.
- A unit test verifies `buildWallColliders` emits one collider per cover piece
  with the correct AABB, and that `buildDungeon` returns one mesh per cover piece
  and per platform (assert mesh counts / positions).

## Technical Specs

- `game/client/dungeon.js`:
  - In `buildDungeon()`, after the room loop, add a `for (const c of
    layout.cover || [])` block that builds a `THREE.Mesh` box per cover piece
    using `wallMaterial`, positioned with base at `sampleFloorY(layout, c.x,
    c.z) ?? DEFAULT_FLOOR_Y`. Push into `meshes` and add to the scene.
  - Add a `for (const p of layout.platforms || [])` block that renders each
    platform's sloped floor. A platform has the same `{ width, depth,
    floorCorners }` fields a room needs, so adapt it into the existing
    `buildSlopedFloor(room, mat)` call (pass a platform-shaped object). Use a
    distinguishable but existing floor material.
  - In `buildWallColliders()`, after rooms/passages, iterate `layout.cover ||
    []` and push `{ minX: c.x - c.width/2, maxX: c.x + c.width/2, minZ: c.z -
    c.depth/2, maxZ: c.z + c.depth/2 }`.
- `game/client/test/dungeon.test.js`: add a describe block feeding a synthetic
  open-plaza layout (one room + 2 cover + 1 platform) and assert collider count,
  cover collider AABBs, and `buildDungeon` mesh counts.
- Do not change the server payload or `floorSampling` here — this ticket only
  consumes the `cover`/`platforms` data produced by sub-ticket 01.

## Verification: code
