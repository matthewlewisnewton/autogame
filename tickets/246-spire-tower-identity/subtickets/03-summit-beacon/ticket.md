# Summit landmark beacon (spire-ascent treasure tier)

Replace the generic gold treasure pillar on spire-ascent with a distinctive summit
beacon that reads as the tower goal from lower tiers.

## Acceptance Criteria

- For `layout.profile === 'spire-ascent'`, the top (`role: 'treasure'`) tier renders
  a **summit beacon** instead of (or clearly augmenting) the default treasure
  cylinder: taller emissive structure, visible glow (emissive material and/or
  `PointLight`), positioned at `sampleFloorY(layout, room.x, room.z) + offset`.
- Beacon meshes are added to the dungeon mesh list and cleared by `clearDungeon`.
- Other profiles (`training_caverns`, `sunken-canyon`, etc.) still get the existing
  gold treasure marker only.
- Client unit tests locate the beacon group/mesh on a spire-ascent treasure tier and
  assert emissive intensity > 0 and Y position ≥ bottom tier floor + 8 (same bar as
  current spire marker tests).

## Technical Specs

- **`game/client/dungeon.js`**
  - Add `buildSpireSummitBeacon(room, layout)` returning one or more `THREE.Mesh`
    (e.g. stacked cylinder + cap, emissive `MeshStandardMaterial`, optional
    `PointLight` child) at the treasure room centre.
  - In the treasure-marker branch, branch on `layout.profile === 'spire-ascent'` to
    call the beacon builder; keep the existing marker for other profiles.
- **`game/client/test/dungeon.test.js`**
  - Add tests using `spireAscentFixture()` and `generateLayout(42, 'spire-ascent')`
    that find beacon mesh(es) by userData tag or geometry signature and assert
    emissive/glow properties and floor-relative height.

## Verification: code
