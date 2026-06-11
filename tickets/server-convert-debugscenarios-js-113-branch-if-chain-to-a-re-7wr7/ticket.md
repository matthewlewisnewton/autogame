# Server: convert debugScenarios.js 113-branch if-chain to a registry and move debug hooks out of hot gameplay paths

## Difficulty: medium

## Goal

applyDebugScenario (game/server/debugScenarios.js:297-3253) is one ~3000-line function with 113 sequential string-compare branches sharing copy-pasted setup (layout apply, spawn, hand sync). Scenario flags also leak into production code: handleUseCard flips a non-playing run.status back to playing when CARD_PROBE_DEBUG_SCENARIOS.has(player.debugScenario) (game/server/cardEffects.js:254-258), and regenMagicStones special-cases summon-low-mana / telepipe grace windows on every tick for every player (game/server/simulation.js:3223-3231). Fix: convert to a registry map { name: setupFn } with shared helpers, and gate debug branches in simulation/cardEffects behind a single nullable player.debugHooks object so the hot path checks one field. Found in code review 2026-06-09.

## Acceptance Criteria

- applyDebugScenario dispatches via a registry map; shared setup extracted to helpers; hot-path debug checks reduced to one nullable field; existing debug-scenario tests pass

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
