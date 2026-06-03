## Fix Quest Completion Snapshot Before-Enemy Count
`game/client/scripts/test-quest-completion.mjs` writes `before.enemies` in the snapshot from `before.player.enemies`, which is undefined because the harness state exposes enemy count at `before.enemies`. The final `harnessState` still carries the useful data, but this field should be corrected so the evidence snapshot is internally consistent.

### Acceptance Criteria
- The quest-completion snapshot records the pre-combat enemy count from `before.enemies`, not `before.player.enemies`.
