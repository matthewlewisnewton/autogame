## Lobby deck HUD integration test

The lobby branch in `syncVanguardHud()` and the `DECK_UPDATE` else path have no dedicated test asserting `#deck-count` updates after `applyLobbyJoinedData` or a lobby-phase `DECK_UPDATE`. A small `main.js` vitest would lock the fix against regressions.

### Acceptance Criteria
- After simulated `applyLobbyJoinedData` with a 12-card `selectedDeck`, `#deck-count.textContent` is `Deck: 12/12` while `gamePhase === 'lobby'`.
- After a lobby-phase `DECK_UPDATE` socket event, `#deck-count` and type-count spans match the new loadout.

## Harness lobby-phase deck probe

Round-1 fallback capture probes only `playing` phase. The harness should snapshot `#deck-count` text (and optionally `getComputedStyle(#deck-stats-panel).display`) immediately after hub join, before ready/deploy.

### Acceptance Criteria
- `metrics.json` includes a lobby-phase probe with `deckCountText` matching `/Deck: [1-9]/` for a fresh account with a starter loadout.
- Hub screenshot in capture shows the deck strip when the ticket expects it visible.

## syncVanguardHud early-return without me

When `syncVanguardHud(null, 'lobby')` runs, HP/currency update but `updateDeckStats` is skipped (~2184–2187). If this path is reachable, deck DOM can stay stale.

### Acceptance Criteria
- Either document the path as unreachable after join, or call `updateDeckStats(mySelectedDeck, [], myInventory)` in the `!me` lobby branch.
