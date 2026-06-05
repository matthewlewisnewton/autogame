# Booth interact opens character editor + `?booth=character` hook

Wire the hub booth interaction primitive to open the character booth overlay when
the player interacts at the `character` booth anchor, and add a localhost-only
`?booth=character` URL debug hook so QA can open the editor without walking to
the Salon booth.

## Acceptance Criteria

- A `window` listener on `BOOTH_ACTION_EVENT` (`booth:action`) opens
  `openCharacterBooth()` when `detail.boothId === 'character'` and
  `gameState.gamePhase === 'lobby'`. Other booth ids are ignored.
- Pressing **F** (or clicking the booth prompt) while standing in the `character`
  booth zone in the hub triggers the above flow end-to-end:
  `boothInteract` → server `boothAction` → overlay opens.
- The overlay does not open during `playing` phase or when `boothError` is
  returned (out of range, etc.).
- Closing the overlay returns control to normal hub movement with no stuck input
  or duplicate preview render loops.
- `?booth=character` in the page URL, on `localhost` / `127.0.0.1` / `::1` only
  (same host guard as `debugScenario`), auto-opens the character booth overlay
  once after the client enters the hub lobby phase (hub layout rendered,
  `gamePhase === 'lobby'`). The hook is a no-op on other hostnames and when the
  param is absent.
- `pnpm test` still passes after this sub-ticket.

## Technical Specs

- `game/client/main.js` — import `BOOTH_ACTION_EVENT` from `boothPrompt.js`;
  register `window.addEventListener(BOOTH_ACTION_EVENT, …)` to call
  `openCharacterBooth()` for the `character` booth in lobby phase; parse
  `new URLSearchParams(window.location.search).get('booth')` alongside the
  existing `debugScenario` guard; after hub lobby is established (e.g. in the
  same code path that calls `renderHubScene()` / shows `#lobby`), if
  `booth === 'character'` and allowed host, call `openCharacterBooth()` once
  (use a `boothDebugRequested` flag mirroring `debugScenarioRequested`).
- `game/client/characterBooth.js` — no structural changes expected; consumed by
  main wiring.
- `game/client/boothPrompt.js` — `BOOTH_DISPLAY_NAMES.character` already reads
  "Character"; no change required unless the prompt label should differ.

## Verification: code
