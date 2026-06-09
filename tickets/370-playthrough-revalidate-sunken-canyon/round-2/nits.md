## Avoid Boss HUD Quest-Title Overlap

In the Sunken Canyon boss-active screenshot, the stage boss HUD is visible and functional, but the boss name/health bar sits close enough to the existing quest title text that the labels visually overlap. This is non-blocking because the HUD data is correct and readable enough for validation, but it would be worth spacing these top-center elements apart for polish.

### Acceptance Criteria
- During an active stage-boss encounter, the boss HUD label/health bar and the quest title/objective text do not overlap at the default validation viewport.
