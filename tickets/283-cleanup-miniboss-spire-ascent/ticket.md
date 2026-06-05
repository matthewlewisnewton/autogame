# Cleanup nits from 262-miniboss-spire-ascent

> **Staleness note.** This follow-up ticket was written against commit
> `3462a3c2` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `262-miniboss-spire-ascent`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Use Summit-Specific In-Run Objective Copy

The quest board uses "summit warden" copy for Spire Ascent Tier 2, but the shared `stage_boss` objective label still says "defeat the stage warden" during the run. This is non-blocking because the enemy type, quest summary, and encounter behavior are correct, but aligning the in-run label would make the summit fight feel more bespoke.

### Acceptance Criteria
- Spire Ascent Tier 2's in-run objective label uses summit-specific wording, while Arena Trials keeps trial-warden wording.
- Existing stage-boss objective tests cover the quest-specific label behavior.
