## Parameterize Playthrough Findings Labels
`harness/validate/lib/findings.mjs` still renders `# Rooms validation findings` and `bossSpawned (annex_overseer)` for every preset, including `open-plaza`. The underlying run summary is correct, but the report labels are misleading for non-Rooms validations.
### Acceptance Criteria
- The findings title reflects the active preset or validation target.
- The boss-spawn assertion label uses the preset's configured `bossType`.

## Restore Arena Champion Model Asset
The Open Plaza validation console records a failed load for `/models/arena-champion.glb`, causing the arena champion to render with a fallback placeholder mesh. This did not block gameplay validation, but the stage boss should have a valid asset or an intentionally mapped fallback.
### Acceptance Criteria
- Loading `arena_champion` does not emit a GLTF parse/load warning.
- The Arena Trials boss renders with an intended model or documented intentional fallback.

## Stabilize Open Plaza Full-HP Playthrough
`validation/open-plaza/findings.md` reports that repeated executions of the same command only reached victory in 2 of 5 runs, with failures from navigation or full-HP boss timeout. The committed green run is valid, but future validation will be more useful if this preset is deterministic.
### Acceptance Criteria
- Repeated `open-plaza` full playthrough runs consistently reach the boss and finish within timeout.
- Any timeout increases, navigation improvements, or purpose-built debug shortcuts preserve the normal gameplay path being validated.

## Review Stage-Boss Victory Summary Counts
The victory screenshots show `Hostiles purged: 0` even after an Arena Trials stage-boss run completes and pays rewards. If stage-boss contracts intentionally omit defeated-add or boss counts, the label should be clearer; otherwise the count should reflect defeated enemies.
### Acceptance Criteria
- Stage-boss victory summaries display an accurate defeated-hostile count or a boss-specific completion label.
