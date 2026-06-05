# Character booth tests

Add focused vitest coverage for the character booth overlay, booth-action open
path, debug URL hook, and save-to-avatar sync so the top-level ticket's "Test"
acceptance criterion is met.

## Acceptance Criteria

- New client test file exercises `openCharacterBooth()` / `closeCharacterBooth()`:
  overlay gains/loses `hidden`, `cosmetic-preview.js` `isPreviewOpen()` toggles
  accordingly, and close is idempotent.
- Test dispatches a `booth:action` CustomEvent with `{ boothId: 'character' }`
  while `gamePhase === 'lobby'` and asserts the overlay opens; a non-character
  booth id does not open it.
- Test covers `?booth=character` on a localhost hostname: after simulating hub
  lobby entry, the overlay auto-opens once; without the param it stays closed.
- Test covers save wiring: mock `patchProfile` to succeed, click save, assert
  `gameState.players[myId].cosmetic` reflects the saved selection (e.g. changed
  `bodyColor` or `bodyShape`).
- `pnpm test` passes with no regressions in existing booth or cosmetic tests.

## Technical Specs

- New `game/client/test/characterBooth.test.js` — vitest + jsdom, following
  patterns in `game/client/test/boothPrompt.test.js` and
  `game/client/test/avatar-cosmetic-render.test.js`. Stub required DOM ids
  (`character-booth-overlay`, preview canvas, save button, swatch containers,
  proportion sliders). Mock `patchProfile` / `getAccountCosmetic` from
  `settings.js` as needed.
- `game/client/characterBooth.js` — export any small test helpers if the overlay
  open path is not reachable via `window` alone.
- `game/client/main.js` — ensure `window.openCharacterBooth` and the
  `?booth=character` hook remain testable (no additional production behavior).

## Verification: code
