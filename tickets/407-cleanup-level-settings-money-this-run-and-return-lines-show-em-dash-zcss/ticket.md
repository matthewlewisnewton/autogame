# Cleanup nits from level-settings-money-this-run-and-return-lines-show-em-dash-zcss

> **Staleness note.** This follow-up ticket was written against commit
> `9e98317a` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `level-settings-money-this-run-and-return-lines-show-em-dash-zcss`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Client test: loot > 0 overlay copy after deckUpdate

`level-settings-rewards.test.js` covers zero-loot preview survival and lobby cache clear, but does not assert the formatted `Money this run: {amount}` string after a simulated `deckUpdate` with `lootCurrency > 0`. A third test wiring `deckUpdate` → `openLevelSettingsOverlay()` would lock in the post-pickup display path the ticket is meant to fix.

### Acceptance Criteria
- Add a client test that triggers `deckUpdate` with `returnRewardsPreview.lootCurrency: 15`, opens the Lv overlay, and asserts `#level-loot-earned` contains the formatted amount and `#level-return-currency` is not `—`.

## Harness capture: Lv overlay + loot pickup scenario

Round-1 top-level capture used the generic fallback smoke (lobby → deploy → movement/dodge) and never opened the Lv toolbar or collected currency. Future tickets touching level-settings economics would benefit from a deterministic capture step that picks up loot and screenshots the overlay.

### Acceptance Criteria
- Extend agent-guided or development capture to open `Lv` mid-run after currency loot pickup and assert non-em-dash money lines in probe `bodyText` or a dedicated screenshot.
