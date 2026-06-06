# 01-add-dismiss-lobby-overlay-helper

Add a `dismissLobbyOverlay(page)` helper function to the hub validation driver that hides the `#lobby` DOM overlay so the 3D hub canvas is visible for screenshot capture.

## Acceptance Criteria

- A new `dismissLobbyOverlay(page)` async function exists in `harness/validate/lib/multiPlayer.mjs`
- The function adds the `.hidden` CSS class to `#lobby` via `page.evaluate()`
- The function waits (up to 5 s) for `#lobby` to actually be hidden (`classList.contains('hidden')` and `computedStyle.display === 'none'`)
- The function throws a descriptive error if the overlay does not hide within the timeout
- The function is exported from `multiPlayer.mjs`

## Technical Specs

- **File to change:** `harness/validate/lib/multiPlayer.mjs`
- Add function after `joinLobby()`, export at top-level
- Implementation pattern (matches existing `waitForHubLobby` style):
  ```js
  export async function dismissLobbyOverlay(page) {
    await page.evaluate(() => {
      document.getElementById('lobby')?.classList.add('hidden');
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('lobby');
      return el && el.classList.contains('hidden')
        && window.getComputedStyle(el).display === 'none';
    }, { timeout: 5000 }).catch(() => {
      throw new Error('#lobby overlay did not hide');
    });
  }
  ```

## Verification: code
