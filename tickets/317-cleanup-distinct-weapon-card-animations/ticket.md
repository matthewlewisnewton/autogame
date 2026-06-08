# Cleanup nits from 316-distinct-weapon-card-animations

> **Staleness note.** This follow-up ticket was written against commit
> `823a6cdb` (2026-06-08). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `316-distinct-weapon-card-animations`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Align Weapon Debug Scenario Metadata
The new weapon visual debug scenarios hard-code a few card details that can drift from the shared definitions. For example, `heavy-greatsword-slash-ready` gives Alloy Greatblade and Excalibur Photon fewer charges than `cardDefs.json`, and the `weapon-slash-ready` comment describes Solar Edge as a starter card even though it is a reward card.
### Acceptance Criteria
- Debug-scenario hand setup for weapon QA derives card names and charges from shared card definitions, or the hard-coded values are corrected to match them.
- Scenario comments accurately describe how each showcased card is reached through normal gameplay.
