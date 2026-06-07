# 02-switch-dismiss-to-css-injection

Replace `dismissLobbyOverlay()` in the harness with a CSS-injection approach. After reverting the production code (sub-ticket 01), the plain `.hidden` class toggle will be immediately overridden by the ~20Hz STATE_UPDATE cycle calling `showGameLobby()`. Instead of fighting the class toggle, inject a `#lobby { display: none !important }` rule via `page.addStyleTag()` — the `!important` flag beats any class-based display value so the lobby stays hidden for the duration of the screenshot capture.

## Acceptance Criteria

- `dismissLobbyOverlay(page)` in `harness/validate/lib/multiPlayer.mjs` uses `page.addStyleTag()` to inject `#lobby { display: none !important }` instead of `page.evaluate()` to add `.hidden` class
- The function waits (up to 5 s) for `#lobby` computed `display` to become `none` (confirming the CSS rule took effect)
- The function throws a descriptive error if the overlay does not hide within the timeout
- No changes to `game/client/main.js` or any other production code
- `harness/validate/playthrough.mjs` continues to import and call `dismissLobbyOverlay` unchanged (same function name, same signature)

## Technical Specs

- **File to change:** `harness/validate/lib/multiPlayer.mjs`
- Replace the body of `dismissLobbyOverlay(page)`:
  ```js
  export async function dismissLobbyOverlay(page) {
    await page.addStyleTag({
      content: '#lobby { display: none !important; }',
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('lobby');
      return el && window.getComputedStyle(el).display === 'none';
    }, { timeout: 5000 }).catch(async () => {
      const state = await page.evaluate(() => {
        const el = document.getElementById('lobby');
        return {
          exists: !!el,
          display: el ? window.getComputedStyle(el).display : null,
        };
      });
      throw new Error(`#lobby overlay did not hide within 5 s: ${JSON.stringify(state)}`);
    });
  }
  ```
- Key difference from current: uses `page.addStyleTag({ content: '...' })` instead of `page.evaluate(() => document.getElementById('lobby')?.classList.add('hidden'))`
- The `!important` ensures the injected rule wins over any inline or class-based `display` value the game code sets

## Verification: code
