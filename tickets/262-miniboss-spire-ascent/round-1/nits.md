## Use Summit-Specific In-Run Objective Copy

The quest board uses "summit warden" copy for Spire Ascent Tier 2, but the shared `stage_boss` objective label still says "defeat the stage warden" during the run. This is non-blocking because the enemy type, quest summary, and encounter behavior are correct, but aligning the in-run label would make the summit fight feel more bespoke.

### Acceptance Criteria
- Spire Ascent Tier 2's in-run objective label uses summit-specific wording, while Arena Trials keeps trial-warden wording.
- Existing stage-boss objective tests cover the quest-specific label behavior.
