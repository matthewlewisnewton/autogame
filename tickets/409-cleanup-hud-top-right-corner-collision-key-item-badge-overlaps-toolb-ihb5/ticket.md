# Cleanup nits from hud-top-right-corner-collision-key-item-badge-overlaps-toolb-ihb5

> **Staleness note.** This follow-up ticket was written against commit
> `3a215cf8` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `hud-top-right-corner-collision-key-item-badge-overlaps-toolb-ihb5`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Harness capture: lock-on + comms simultaneous screenshot

Round-1 fallback capture exercises dodge-roll and level-entry comms but never presses Z to activate lock-on while the comms log is populated. Unit tests cover this matrix; a harness screenshot of lock-on panel stacked above comms log would give visual QA parity with the toolbar and toast scenarios.

### Acceptance Criteria
- Capture plan includes a step that lock-ons nearest enemy (Z) while at least one comms log line is visible.
- Screenshot at 1280×800 shows `#lock-on-info-panel` fully above `#quest-comms-log` with no overlap.

## Harness capture: 1920×1080 viewport screenshot

Regression tests assert no overlaps at 1920×1080, but round-1 screenshots are all from the default 1280×800 browser window. A single wide-viewport capture would document the fix at the ticket’s second required resolution.

### Acceptance Criteria
- At least one in-run screenshot taken at 1920×1080 with key-item badge, toolbar, and comms log all visible.
- Visual review confirms the same vertical stacking seen at 1280×800.
