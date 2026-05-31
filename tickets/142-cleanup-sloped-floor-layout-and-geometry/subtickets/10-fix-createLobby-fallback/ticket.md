# Fix createLobby fallback when squad lobby is already active

The `createLobby` handler in `screenshot.mjs` unconditionally attempts to fill `#create-lobby-name`, which fails when `#lobby-browser` is hidden (e.g. after a partial failed run where the player is already in a squad lobby). This causes the fallback recipe to time out.

## Acceptance Criteria
- `harness/screenshot.mjs` `createLobby` handler checks whether `#lobby` (squad UI) is already visible before attempting to create a new lobby.
- If `#lobby` is visible, treat the create step as already done and skip filling the form.
- If `#lobby` is not visible but `#lobby-browser` is hidden, wait briefly for `#lobby-browser` to become visible (post-login) before filling the form.
- On timeout, log a warning but do not crash the capture.

## Technical Specs
- **File**: `harness/screenshot.mjs` (`createLobby` handler, ~547–569)
  - Before filling `#create-lobby-name`, add:
    1. Check `#lobby` visibility — if visible, `continue` (already in squad)
    2. If `#lobby-browser` is not visible, use `page.waitForFunction` with a short timeout (e.g. 5000ms) to wait for it to appear; on timeout, log warning and attempt fill anyway
  - Keep existing `waitForFunction` for `#lobby` visibility after clicking create

## Verification: code
