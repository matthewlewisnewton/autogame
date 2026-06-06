## Refresh Telepipe Documentation For In-Memory Pause Model
Several docs still describe the old checkpoint-based Telepipe design (`suspendedCheckpoint`, `captureRunCheckpoint()`, `restoreRunCheckpoint()`, and abandon/resume checkpoint flow) even though this ticket moved the implementation toward in-memory run pause plus durable player HP/MS. Updating the docs will keep future tickets from rebuilding against removed concepts.

### Acceptance Criteria
- `game/docs/design.md`, `game/docs/lobbies.md`, `game/docs/telepipe-tier2-context.md`, and `game/docs/gameplay-review.md` no longer describe checkpoint restore as the current Telepipe implementation.
- The docs describe HP/Magic Stones as persistent player state and identify the Medic booth as the only full-health restoration path.
