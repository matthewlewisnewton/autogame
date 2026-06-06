## Remove Unused Debug Scenario Helpers

`game/server/debugScenarios.js` now contains unused helpers (`bandAt` and `clusterAnchorForBand`) left behind from the canyon add-clustering work. They are harmless, but removing them would keep the debug scenario module easier to scan.

### Acceptance Criteria
- `bandAt` and `clusterAnchorForBand` are removed, or reused intentionally with tests/coverage showing why they remain.
