# 01-call-updateDeckStats-in-lobby-phase

Call `updateDeckStats()` in the lobby phase so the hub HUD shows the player's actual selected-deck size instead of the initial 'Deck: 0/0'.

## Acceptance Criteria

- `syncVanguardHud()` calls `updateDeckStats()` when `gamePhase === 'lobby'` (not just `'playing'`), using `mySelectedDeck` as the deck pile and `myInventory` for type breakdown
- `#deck-count` text reflects the selected deck size (e.g. `Deck: 8/8` or `Deck: 12/12`) when standing in the 3D hub after login
- The `DECK_UPDATE` socket handler also calls `updateDeckStats()` when NOT in a run so the HUD refreshes after deck-editor changes in lobby
- Existing tests continue to pass (`pnpm test` from `game/`)

## Technical Specs

- **game/client/main.js** (~line 2193): In `syncVanguardHud()`, add an `else if (gamePhase === 'lobby')` branch that calls `updateDeckStats(mySelectedDeck, [], myInventory)` — empty hand since lobby has no dealt hand, `mySelectedDeck` is the full deck pile
- **game/client/socketHandlers/lobbyHandlers.js** (~line 40–46): In the `DECK_UPDATE` handler, after the `if (inRun) { … }` block, add an `else` branch that calls `ctx.updateDeckStats(ctx.mySelectedDeck, [], ctx.myInventory)` — the `renderDeckEditor()` below already runs unconditionally
- No server changes required; this is a purely client-side HUD fix

## Verification: code
