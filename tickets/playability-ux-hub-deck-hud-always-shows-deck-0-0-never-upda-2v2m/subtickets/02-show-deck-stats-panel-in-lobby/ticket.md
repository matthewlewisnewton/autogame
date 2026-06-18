# Show deck stats panel in lobby phase

The `#deck-stats-panel` (containing `#deck-count` and type breakdown) is CSS-hidden (`display: none`) under `body[data-phase="lobby"]`, so players in the 3D hub cannot see their deck info even though sub-ticket 01 correctly populates the DOM. Remove the panel from the lobby hide rule so deck stats are visible in the hub.

## Acceptance Criteria
- `#deck-stats-panel` is **not** in the `body[data-phase="lobby"]` hide list in `style.css` (lines ~2031–2035)
- `#ms-bar-container`, `#status-effect-strip`, `#objective-hud` remain hidden in lobby phase (unchanged)
- Hub screenshot (lobby phase) shows `Deck: N/N` with correct type counts after joining

## Technical Specs
- **File:** `game/client/style.css` — remove `body[data-phase="lobby"] #deck-stats-panel,` from the compound hide rule at lines 2031–2035
- Keep the hide rule for `#ms-bar-container`, `#status-effect-strip`, `#objective-hud` intact

## Verification: code
