## Dead reference to questSuspendedLocked in clearSuspendedRunUi
After removing the client-side quest-selection lock, `clearSuspendedRunUi()` in
`game/client/main.js` (~line 506) still checks
`questErrorEl.textContent === THEME.run.questSuspendedLocked` before clearing the
error element. The client no longer ever writes that text, so the branch is dead.
Worth tidying so future readers don't assume that error path is still live.
### Acceptance Criteria
- The dead `questSuspendedLocked` comparison in `clearSuspendedRunUi` is removed
  (or the clearing is made unconditional), with no behavior change to banner
  clearing.

## Client ignores server's suspended_checkpoint quest error
When a player reselects the SAME quest while a run is suspended, the server emits
`QUEST_ERROR { reason: 'suspended_checkpoint' }`, but `game/client/main.js` has no
handler for that event, so the click is a silent no-op with no feedback. Functionally
fine (deploying still resumes), but a small toast/hint would make the "same quest =
resume, different quest = new run" model clearer to the player.
### Acceptance Criteria
- Selecting the already-suspended quest shows a brief, non-blocking hint (e.g.
  "Deploy to resume, or pick a different quest to start fresh") instead of nothing.
