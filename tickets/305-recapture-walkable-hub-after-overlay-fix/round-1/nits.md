## Keep Hub Validation Logs Per Run

`game/validation/hub/server.log` appears to include output from multiple historical validation attempts, including entries from an older worktree path. This does not block the current ticket because `run-summary.json`, `probes.json`, screenshots, and the verifier are clean, but stale appended logs make later reviews harder to audit.

### Acceptance Criteria
- Hub validation rewrites or rotates `game/validation/hub/server.log` and `game/validation/hub/console.log` for each run so committed evidence contains only the run that produced the current `run-summary.json`.
