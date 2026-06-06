# Cleanup nits from 279-playthrough-validate-sunken-canyon

> **Staleness note.** This follow-up ticket was written against commit
> `dacfee34` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `279-playthrough-validate-sunken-canyon`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove Unused Debug Scenario Helpers

`game/server/debugScenarios.js` now contains unused helpers (`bandAt` and `clusterAnchorForBand`) left behind from the canyon add-clustering work. They are harmless, but removing them would keep the debug scenario module easier to scan.

### Acceptance Criteria
- `bandAt` and `clusterAnchorForBand` are removed, or reused intentionally with tests/coverage showing why they remain.
