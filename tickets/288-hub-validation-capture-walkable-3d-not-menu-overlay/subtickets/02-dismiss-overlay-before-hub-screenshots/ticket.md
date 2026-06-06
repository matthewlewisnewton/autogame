# 02-dismiss-overlay-before-hub-screenshots

Import `dismissLobbyOverlay` into the playthrough driver and call it before every hub-walk screenshot capture so the 3D ship hub is visible without the 2D "Lobby Connection" menu overlay.

## Acceptance Criteria

- `dismissLobbyOverlay` is imported from `./lib/multiPlayer.mjs` in `harness/validate/playthrough.mjs`
- `runHubWalkStep()` calls `dismissLobbyOverlay(hostPage)` **before** the overview screenshot (`01-hub-overview.png`)
- `runHubWalkStep()` calls `dismissLobbyOverlay(hostPage)` **before** each zone screenshot (`02-room-operations`, `03-room-commerce`, `04-room-salon`) inside the zone loop
- The lobby overlay dismissal does NOT affect the booth step or telepipe-reset step (those use `#lobby` interactively)
- Existing hub-walk behavior (two-player join, squadmate movement, zone walking) is unchanged

## Technical Specs

- **File to change:** `harness/validate/playthrough.mjs`
- Add `dismissLobbyOverlay` to the import from `./lib/multiPlayer.mjs` (line ~37):
  ```js
  import {
      waitForHubLobby,
      createLobby,
      joinLobby,
      dismissLobbyOverlay,   // ← new
  } from './lib/multiPlayer.mjs';
  ```
- In `runHubWalkStep()`, insert `await dismissLobbyOverlay(hostPage);` before each `writeScreenshot()` call:
  - Before `const overviewScreenshot = await writeScreenshot(hostPage, outDirAbs, '01-hub-overview');`
  - Inside the zone `for` loop, before `const shotPath = await writeScreenshot(hostPage, outDirAbs, shotName);`

## Verification: code
