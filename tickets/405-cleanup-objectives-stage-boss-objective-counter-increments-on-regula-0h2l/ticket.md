# Cleanup nits from objectives-stage-boss-objective-counter-increments-on-regula-0h2l

> **Staleness note.** This follow-up ticket was written against commit
> `4ef6360d` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `objectives-stage-boss-objective-counter-increments-on-regula-0h2l`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Tidy the countStageBossObjectiveKills doc comment
The JSDoc on `countStageBossObjectiveKills` in `game/server/encounters.js` reads
awkwardly ("the encounter boss (only while active) and adds tagged
`encounterHostile`, excluding scripted waves") — a grammatical slip that makes the
intent slightly harder to scan. Worth a one-line cleanup so the rule is unambiguous
for future readers.
### Acceptance Criteria
- The JSDoc for `countStageBossObjectiveKills` is a grammatical, clear sentence
  stating exactly which kills count (active-phase boss + `encounterHostile` adds)
  and which are excluded (`scriptedWave` / non-encounter spawns).
