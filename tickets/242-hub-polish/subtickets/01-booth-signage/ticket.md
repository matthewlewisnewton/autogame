# Hub Booth Signage & Labels

Render a visible kiosk structure with a floating name sign at each of the six
hub booth anchors. Today the booths (`quest`, `launch`, `shop`, `deck`,
`character`, `hats`) are invisible proximity zones — `buildDungeon` draws no
geometry at `layout.boothAnchors`, so players cannot see or identify a booth
until the proximity prompt fires. This adds the always-visible signage that
makes the shared hub readable.

The other two hub-polish features already exist and must NOT be re-touched here:
the proximity interaction prompt (`client/boothPrompt.js`, `#booth-prompt`,
wired in `client/main.js`) and other-player nameplates
(`createNameplate` in `client/renderer.js`, applied in the render loop). This
sub-ticket only fills the missing signage gap.

## Acceptance Criteria

- A new module `game/client/boothSigns.js` exports a builder (e.g.
  `buildHubBoothSigns(boothAnchors, floorY)`) that returns an array of
  `THREE.Object3D`s: for each known booth anchor, a visible kiosk structure
  (a solid counter/post mesh) plus a canvas-texture text sign sprite.
- Each booth's sign text matches its display name from
  `BOOTH_DISPLAY_NAMES` in `client/boothPrompt.js`
  (`Quest Board`, `Launch Bay`, `Shop`, `Deck Editor`, `Character`, `Hats`).
- Each kiosk + sign is positioned at its anchor's `(x, z)`, resting on the hub
  floor at the supplied `floorY`, with the sign sprite floating above the kiosk.
- A booth anchor whose id is not in `BOOTH_DISPLAY_NAMES` is skipped (no sign);
  a missing/empty/`null` `boothAnchors` argument yields an empty array.
- `buildDungeon` (`game/client/dungeon.js`) adds the booth signs to the scene
  **only** when `layout.profile === 'hub'` and `layout.boothAnchors` is present,
  and pushes every created object into the returned `meshes` array so they are
  disposed on layout rebuild (no leak). Non-hub layouts render no booth signs.
- Unit tests in `game/client/test/boothSigns.test.js` cover: one sign group is
  built per known anchor, the sign text equals the `BOOTH_DISPLAY_NAMES` value,
  unknown booth ids are skipped, and missing/empty anchors produce an empty
  array.
- Full client test suite passes (`pnpm --filter ./client test` / `pnpm test`).

## Technical Specs

- **New: `game/client/boothSigns.js`**
  - Import `BOOTH_DISPLAY_NAMES` from `./boothPrompt.js`.
  - Export `buildHubBoothSigns(boothAnchors, floorY = DEFAULT_FLOOR_Y)` that
    iterates `Object.entries(boothAnchors)`, skips ids not present in
    `BOOTH_DISPLAY_NAMES` and anchors with non-finite `x`/`z`, and for each
    valid booth builds a kiosk (e.g. a `THREE.BoxGeometry` counter/post on a
    `MeshStandardMaterial`) plus a text sign sprite, positioned at
    `(anchor.x, floorY + offset, anchor.z)`. Return a flat array of the created
    objects (mesh + sprite per booth).
  - For the sign sprite, mirror the canvas-texture pattern of `createNameplate`
    in `client/renderer.js` (offscreen `<canvas>`, rounded-rect background,
    centered bold text, `THREE.CanvasTexture` + `THREE.SpriteMaterial`,
    `sprite.userData` recording the booth id and label). Keep the helper
    self-contained so it is unit-testable under jsdom + the existing three mock.
- **Edit: `game/client/dungeon.js`**
  - Import `buildHubBoothSigns` from `./boothSigns.js`.
  - Inside `buildDungeon`, after the room/wall loop, add:
    `if (layout.profile === 'hub' && layout.boothAnchors) { for (const obj of buildHubBoothSigns(layout.boothAnchors, FLOOR_Y)) { scene.add(obj); meshes.push(obj); } }`
    (reuse the `FLOOR_Y`/`resolveFloorY`/`sampleFloorY` already imported there for
    the floor height).
- **New: `game/client/test/boothSigns.test.js`**
  - Follow the structure of existing client tests (e.g.
    `client/test/boothPrompt.test.js`, `client/test/hub-lobby-render.test.js`)
    for three mocking / jsdom setup.
- Do not modify `client/boothPrompt.js`, the nameplate code in
  `client/renderer.js`, server files, or `shared/boothZones*`. The six booth
  ids and anchor positions come from `generateHub` in `server/dungeon.js`
  (unchanged).

## Verification: code
