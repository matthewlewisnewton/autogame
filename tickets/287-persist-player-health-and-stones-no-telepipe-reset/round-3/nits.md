## Remove Stale Checkpoint/Run-Suspended References
Several non-runtime docs and validation scripts still describe the old Telepipe checkpoint resume model (`suspendedCheckpoint`, `restoreRunCheckpoint`, `runSuspended`, and "Resume expedition"). The live server no longer uses that model, so these stale artifacts can mislead future debugging or validation work.
### Acceptance Criteria
- Update or archive stale checkpoint-resume references in `game/docs/telepipe-tier2-context.md`, `game/docs/gameplay-review.md`, `game/docs/lobbies.md`, and old walkthrough/validation scripts so they match the durable-vitals, fresh-run Telepipe policy.
- Keep historical validation logs clearly marked as historical if they remain in the repository.

## Remove Unused Run Suspended Event Constant
`game/shared/events.json` still defines `RUN_SUSPENDED`, but the live server no longer emits `runSuspended` after the checkpoint-resume removal. Leaving the event around suggests there is still a supported suspended-run UI path.
### Acceptance Criteria
- Remove `RUN_SUSPENDED` from shared event definitions if no live code consumes it, or document it explicitly as deprecated.
- Ensure client/server tests still pass after removing or deprecating the unused event.
