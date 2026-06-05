## Remove Unused Debug Booth Flag

`game/client/main.js` declares `debugBoothAllowed`, but the actual host gating lives in `boothDeck.js` through `shouldOpenDebugBooth()`. Removing the unused local flag would make the debug hook wiring a little clearer.

### Acceptance Criteria
- `debugBoothAllowed` is removed or used directly, with no change to the localhost-only `?booth=deck` behavior.
