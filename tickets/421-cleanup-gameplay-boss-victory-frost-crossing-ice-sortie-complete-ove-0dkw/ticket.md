# Cleanup nits from gameplay-boss-victory-frost-crossing-ice-sortie-complete-ove-0dkw

> **Staleness note.** This follow-up ticket was written against commit
> `91636530` (2026-06-17). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `gameplay-boss-victory-frost-crossing-ice-sortie-complete-ove-0dkw`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Capture an actual ice-victory Sortie Complete screenshot

This round's capture fell back to the `telepipe-ready` suspend/resume scenario
(`capturePlanSource: "fallback"`), so there is no visual artifact of the frost_crossing (ice)
Sortie Complete overlay staying up after boss defeat — the exact regression the ticket fixed.
The behavior is proven by unit tests, but a visual capture would close the loop and match the
known-good `game/validation/ice/10-victory.png` reference. Worth wiring an ice-victory capture
plan (or making the fallback exercise the boss-victory overlay) so future regressions to this
overlay are caught visually.

### Acceptance Criteria
- An ice/frost_crossing capture plan drives a real (or `frost-crossing-boss-low-hp` debug) boss
  defeat and screenshots the `#run-summary-overlay` with `#summary-status` = "Sortie Complete".
- `metrics.json` for that capture records a probe with `sortieCompleteOverlayVisible: true`.

## Misleading 03 sub-ticket commit message

The `03-ice-playthrough-victory-harness` commit message claims it "Add[s] harness playthrough
driver for ice/frost_crossing preset", but its diff touches only `game/` files and ticket.md —
the `harness/validate/playthrough.mjs` driver already existed. Harmless, but the message
overstates what landed and could mislead future archaeology.

### Acceptance Criteria
- Commit-message / ticket wording for harness-related work reflects the files actually changed.
