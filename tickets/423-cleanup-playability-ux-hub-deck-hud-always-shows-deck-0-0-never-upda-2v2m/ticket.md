# Cleanup nits from playability-ux-hub-deck-hud-always-shows-deck-0-0-never-upda-2v2m

> **Staleness note.** This follow-up ticket was written against commit
> `d795a6e7` (2026-06-18). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `playability-ux-hub-deck-hud-always-shows-deck-0-0-never-upda-2v2m`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Lobby deck HUD integration test

The lobby branch in `syncVanguardHud()` and the `DECK_UPDATE` else path have no dedicated test asserting `#deck-count` updates after `applyLobbyJoinedData` or a lobby-phase `DECK_UPDATE`. A small `main.js` vitest would lock the fix against regressions.

### Acceptance Criteria
- After simulated `applyLobbyJoinedData` with a 12-card `selectedDeck`, `#deck-count.textContent` is `Deck: 12/12` while `gamePhase === 'lobby'`.
- After a lobby-phase `DECK_UPDATE` socket event, `#deck-count` and type-count spans match the new loadout.

## Harness lobby-phase deck probe

Round-2 hub screenshot shows the fix visually, but structured probes still only capture deck text in `playing` phase. A lobby-phase probe would make regressions machine-detectable without relying on screenshot review.

### Acceptance Criteria
- `metrics.json` includes a lobby-phase probe with `deckCountText` matching `/Deck: \d+\/\d+/` for a fresh account with a starter loadout.
- Probe asserts `getComputedStyle(#deck-stats-panel).display` is not `none` when `phase === 'lobby'`.

## syncVanguardHud early-return without me

When `syncVanguardHud(null, 'lobby')` runs, HP/currency update but `updateDeckStats` is skipped (`main.js` ~2184–2187). If this path is reachable, deck DOM can stay stale.

### Acceptance Criteria
- Either document the path as unreachable after join, or call `updateDeckStats(mySelectedDeck, [], myInventory)` in the `!me` lobby branch.

## Stale stateHandlers comment

`stateHandlers.js` line 128 comment says "MS/deck/portrait in-run only" but deck stats now also refresh in lobby via `syncVanguardHud`. Update the comment to avoid misleading future editors.

### Acceptance Criteria
- Comment accurately describes lobby vs playing HUD update responsibilities.
