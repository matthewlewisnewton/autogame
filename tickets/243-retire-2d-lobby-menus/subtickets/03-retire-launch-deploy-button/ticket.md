# Retire the 2D launch / Deploy button

Remove the old 2D `#ready-btn` ("Deploy") so ready-up and run start happen only
through the launch booth. The launch booth already performs ready-up +
`startGame`; this sub-ticket removes the redundant button and re-routes the
suspended-run resume path (which currently reuses `#ready-btn`) through the booth
so nothing is orphaned.

## Acceptance Criteria

- The `#ready-btn` ("Deploy"/"Sortie") button no longer exists in
  `game/client/index.html`.
- The launch booth performs ready-up and triggers `startGame` for the party; the
  `?booth=launch` debug hook still triggers it.
- Resuming a suspended run still works via the launch booth — there is no
  remaining code path that depends on `#ready-btn` to resume.
- The `#lobby-browser` (lobby-finder) menu is unchanged.
- Tests green (`pnpm test` server + client).

## Technical Specs

- `game/client/index.html`: delete the `<button id="ready-btn">` element.
- `game/client/main.js`: remove the `readyBtn` reference, its click handler, and
  the now-dead label/visibility sync helpers (`syncReadyBtn`-style code around
  the `THEME.lobby.deploy` / `THEME.run.resumeSortie` labels and
  `setDeployButtonVisible`). Ensure the launch-booth ready-up path
  (`launchBoothReadyUp` → `playerReady(true)`) covers both a fresh deploy and a
  suspended-run resume sortie, since `#ready-btn` previously served both.
- `game/client/launchBooth.js`: keep `shouldLaunchReadyUp`, `isLaunchBoothAction`,
  `getBoothDebugHook`, and the `?booth=launch` hook intact.
- Update affected tests: `game/client/test/main.test.js`, `launchBooth.test.js`,
  and any test whose DOM fixture includes `#ready-btn`
  (`boothShop.test.js`, `boothDeck.test.js`, `questBooth.test.js`,
  `characterBooth.test.js`, `hub-presence-avatars.test.js`,
  `deck-viewer.test.js`, `debug-godmode.test.js`, `debug-hatswap-hook.test.js`,
  `key-item-dodge.test.js`) — remove the obsolete button from fixtures/assertions.

## Verification: code
