# Cleanup nits from 370-playthrough-revalidate-sunken-canyon

> **Staleness note.** This follow-up ticket was written against commit
> `a718830b` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `370-playthrough-revalidate-sunken-canyon`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Avoid Boss HUD Quest-Title Overlap

In the Sunken Canyon boss-active screenshot, the stage boss HUD is visible and functional, but the boss name/health bar sits close enough to the existing quest title text that the labels visually overlap. This is non-blocking because the HUD data is correct and readable enough for validation, but it would be worth spacing these top-center elements apart for polish.

### Acceptance Criteria
- During an active stage-boss encounter, the boss HUD label/health bar and the quest title/objective text do not overlap at the default validation viewport.
