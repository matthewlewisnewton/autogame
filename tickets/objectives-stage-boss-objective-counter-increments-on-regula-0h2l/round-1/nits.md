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
