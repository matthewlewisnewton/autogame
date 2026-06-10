# Cleanup nits from quest-briefings-mid-run-radio-dialogue-named-client-npc-rewa-o0vv.3

> **Staleness note.** This follow-up ticket was written against commit
> `8195c8b4` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `quest-briefings-mid-run-radio-dialogue-named-client-npc-rewa-o0vv.3`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Wire Tier-2 Support Radio Beats
Some tier-2 stage-boss quest definitions include `{ waveCleared }` dialogue for support-count progress, while the current `waveCleared` emission path is only wired for survive objectives. This is outside the current tier-1 acceptance path, but those authored tier-2 lines should either use a supported trigger or get a stage-boss support-defeat hook before future QA relies on them.

### Acceptance Criteria
- Tier-2 stage-boss support-count dialogue fires from server-side progression when the configured support threshold is reached, or the quest content is changed to use only currently supported triggers.
