## Exclude harness subticket files from implementation branch diff

Top-level acceptance says only `game/docs/design.md` should change; `git diff` from baseline also adds `tickets/156-docs-design-md-stale-fixes/subtickets/*/ticket.md`. These are decomposition metadata, not game deliverables, but they muddy literal AC compliance and review scope.
### Acceptance Criteria
- Implementation commits for doc-only tickets contain changes under `game/docs/` only (harness ticket folders updated separately or left untracked).
