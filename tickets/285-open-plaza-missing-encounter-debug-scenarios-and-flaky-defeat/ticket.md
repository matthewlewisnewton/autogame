# 285-open-plaza-missing-encounter-debug-scenarios-and-flaky-defeat

## Difficulty: medium

## Goal

Found by the open-plaza playthrough-validation (278). Unlike rooms (training-caverns) and sunken-canyon, the open-plaza / arena_trials level has NO near-adds / boss-approach / boss-low-hp debug scenarios, and its single-room "one distant centre boss" layout makes the encounter hard to reach and the full-HP arena_champion hard to defeat.

EVIDENCE (operator notes in validation/open-plaza/findings.md, committed): across 5 executions of the exact validation command — 2 reached victory, 2 activated the encounter but could NOT bring the full-HP arena_champion to 0 within the 180s defeatBoss timeout, and 1 never activated the encounter (driver nudge-nav stranded the player ~20u from the centre boss; trigger radius is 8). The run is real but non-deterministic.

DO:
1. Add open-plaza/arena_trials debug scenarios mirroring the other levels: an adds-cluster scenario, a boss-approach scenario (places the player within the encounter trigger radius of arena_champion), and a boss-low-hp scenario. Register in game/server (see canyon-descent-* / training-caverns-* as the pattern). Debug-only + the state must remain reachable via normal play.
2. Investigate why a full-HP arena_champion cannot be brought to 0 within 180s even in god-mode (driver attack DPS vs boss HP / tuning) and note whether arena_champion HP is tuned high relative to the others.

This makes open-plaza validation deterministic AND improves the level encounter scaffolding. SCOPE: game/server/debugScenarios.js + game/server (scenario registration), game/server/test; harness/validate or game/validate driver navigation only if needed.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
