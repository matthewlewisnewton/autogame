# Migrate remaining debug scenarios and remove the if-chain

## Description

Finish converting every name in `DEBUG_SCENARIOS` to a registry handler and delete the last sequential string-compare branches from `applyDebugScenario`. This completes the refactor: dispatch is exclusively `DEBUG_SCENARIO_REGISTRY[name]`, with shared helpers for any remaining duplication.

## Acceptance Criteria

- `applyDebugScenario` contains zero `if (name ===` / `else if (name ===` scenario branches; only guards, shared player reset, registry lookup, handler invocation, and the shared post-setup epilogue remain
- Every name in `DEBUG_SCENARIOS` (`game/server/index.js` ~507–666) has a corresponding `DEBUG_SCENARIO_REGISTRY` entry
- Registry lookup failure returns `{ ok: false, reason: … }` consistent with current behavior for unknown names (still gated by `DEBUG_SCENARIOS.has(name)` up front)
- Remaining scenario groups are covered, including: summon/combat probes (`summon-ready`, `summon-low-mana`, `monster-card`, `mixed-enemies`, variant enemies, run-failed/exhausted), hub/lobby shortcuts (`lobby-partial-vitals`, `hub-med-booth-ready`, `hat-shop-currency`, quest unlock probes), card-exercise scenarios (`ice-ball-ready`, `fireball-ready`, `*-spells-ready`, `magma-windup-ready`, slash-ready variants), stage/geometry probes (`sloped-dungeon`, `open-plaza-arena`, `sunken-canyon-*`, `lock-on-*`), and escort/passage-lock fixtures
- `pnpm test` passes; full server vitest suite including `debug-scenarios.test.js`, `debug_scenarios_tier1.test.js`, and card-exercise tests

## Technical Specs

- **`game/server/debugScenarios.js`**
  - Move each remaining inline branch body into a named `setup*` function registered in `DEBUG_SCENARIO_REGISTRY`
  - Extract any last duplicated blocks (card hand presets, enemy spawn grids, lobby-only vitals) into shared helpers
  - Ensure handlers that need early return still return `{ ok: true, scenario: name }` before the epilogue; document pattern with a small `returnsEarly` convention or explicit return value
- **`game/server/index.js`**
  - `applyDebugScenario` wrapper stays a thin delegate to `debugScenarios.applyDebugScenario`; no scenario logic added here

## Verification: code
