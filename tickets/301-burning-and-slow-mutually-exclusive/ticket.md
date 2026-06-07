# 301-burning-and-slow-mutually-exclusive

## Difficulty: medium

## Goal

Make BURNING (291) and SLOW/cold (290) MUTUALLY EXCLUSIVE on any entity (players AND enemies) — fire and ice cancel. Never both at once. RULE: applying burning to a slowed entity clears slow first then burns (fire melts ice); applying slow to a burning entity clears burning first then slows (ice douses fire); most-recent wins. Implement inside applyBurning/applySlow (290/291) so every source inherits it. DEPENDS ON 290+291. ACCEPTANCE: slowed-then-burned entity no longer slowed (and vice-versa); never coexist; client shows only active one; server tests both orders on players+enemies. SCOPE: game/server/simulation.js, game/client (indicator), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
