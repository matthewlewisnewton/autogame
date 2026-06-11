# Senior Review — Client: extract a booth module factory

**Ticket:** `client-extract-a-booth-module-factory-boothdeck-js-and-booth-idbm`  
**Baseline:** `78e2f666516df0494e804ca5fb4e8375a7512d91`  
**Commits reviewed:** `7c9d7393` (factory + deck/shop), `30a27d5c` (consolidate `getBoothDebugHook`)

## Runtime health

Captured run is clean:

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`, no `failure_kind`.
- `console.log`: no `pageerror` or `[fatal]` lines. Vite connect logs, `[initScene]`, and `[launchBooth] ready-up via booth` are expected. The `409 (Conflict)` resource errors are harness auth noise, not uncaught game exceptions.
- Harness probe shows `phase: "playing"`, `connectionState: "connected"`, `sceneInitialized: true`, movement and dodge-roll exercised successfully.

The game starts and loads cleanly for this ticket.

## Acceptance criteria

### Single booth factory backs deck/shop (and ideally launch/quest)

**Met.** `game/client/boothCommon.js` introduces `createBoothModule({ boothId, tab, renderDepKey })`, encapsulating the duplicated pattern:

- `shouldOpenDebug` (localhost-gated `?booth=` check)
- `createRequestDebugOpener` (one-shot debug opener)
- `openBooth` (`showGameLobby` → `setLobbyTab` → render dep)
- `isBoothAction` (matches `action` or `boothId`)
- `registerBoothListener` (module-scoped `listenerRegistered` flag)

`boothDeck.js` and `boothShop.js` are now thin two-line instantiations:

```5:9:game/client/boothDeck.js
const booth = createBoothModule({ boothId: 'deck', tab: 'deck', renderDepKey: 'renderDeckEditor' });

export const shouldOpenDebugBooth = booth.shouldOpenDebug;
export const openDeckBooth = booth.openBooth;
export const registerDeckBoothListener = booth.registerBoothListener;
```

For launch/quest booths, full factory adoption is not appropriate — they have distinct open semantics (ready-up vs quest-panel reveal). The ticket's "ideally" scope is satisfied by consolidating the shared `getBoothDebugHook` into `boothCommon.js` and re-exporting it from `launchBooth.js` and `questBooth.js`, removing the prior `questBooth → launchBooth` indirection.

### Public exports unchanged

**Met.** All consumer-facing symbols retain their original names and call sites:

| Module | Exports (unchanged) |
|--------|---------------------|
| `boothDeck.js` | `shouldOpenDebugBooth`, `createRequestDebugBoothOpener`, `openDeckBooth`, `registerDeckBoothListener` |
| `boothShop.js` | `shouldOpenDebugShopBooth`, `createRequestDebugShopBoothOpener`, `openShopBooth`, `registerShopBoothListener` |
| `launchBooth.js` | `getBoothDebugHook` (re-export), plus existing launch-specific helpers |
| `questBooth.js` | `getBoothDebugHook` (re-export), plus existing quest-specific helpers |

`main.js` imports are unchanged. `socketHandlers/lobbyBrowserHandlers.js` still receives `getBoothDebugHook` and `LAUNCH_BOOTH_ID` through the socket handler context.

### Existing booth tests pass

**Met.** `round-1/coverage.log` reports **329/329** client tests passing, including all booth-related suites:

- `boothCommon.test.js` (7 new tests covering factory behavior and per-instance listener isolation)
- `boothDeck.test.js`, `boothDeckDebug.test.js`
- `boothShop.test.js`, `boothShopDebug.test.js`
- `launchBooth.test.js`, `questBooth.test.js`

Factory tests explicitly verify call order (`show` → `tab` → `render`), one-shot debug opener semantics, and independent `listenerRegistered` state per module instance.

## Design & regression check

- **Scope:** Pure refactor — no gameplay, socket, or server changes. Aligns with `game/docs/design.md` (no design doc impact).
- **Behavior preservation:** Deck/shop booth open flow, `booth:action` listener matching (`action` or `boothId`), and localhost-only `?booth=deck|shop` auto-open are preserved via the factory.
- **Integration:** `main.js` wiring (`registerDeckBoothListener`, `registerShopBoothListener`, debug openers called on lobby entry) is untouched. Capture exercised the launch-booth ready-up path normally.

## Code quality

- Factory is small, focused, and testable (no `window`/`socket` in the core logic beyond the listener registration guard).
- `renderDepKey` dynamic lookup is a reasonable way to parameterize the render callback without changing the deps object shape expected by `main.js`.
- No dead code or obvious bugs introduced.
- New `boothCommon.test.js` provides meaningful coverage of the extracted abstraction.

## Debug hooks (`?booth=`)

This ticket refactored existing `?booth=` URL shortcuts; it did not add new `?debugScenario=` entries.

- **Deck/shop:** Still gated to localhost loopback hosts via `DEBUG_BOOTH_ALLOWED_HOSTS` inside the factory. Normal gameplay reaches deck/shop through hub booth interaction (`booth:action` events).
- **Launch:** `?booth=launch` auto-ready on lobby join (in `lobbyBrowserHandlers.js`) is unchanged from baseline — pre-existing harness convenience, not weakened by this refactor.
- **Quest:** `getBoothDebugHook` re-export path updated only; quest panel reveal via booth interaction is unchanged.

## Remaining gaps

None. All acceptance criteria are fully met; runtime capture is clean.

VERDICT: PASS
