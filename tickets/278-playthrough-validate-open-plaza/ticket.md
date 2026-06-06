# 278-playthrough-validate-open-plaza

## Difficulty: hard

## Goal

Validate the Open-Plaza (Arena Trials) level-1 run through to its stage boss (Trial Warden / arena_champion). Reuse the playthrough driver from 277-playthrough-validation-harness-and-rooms (harness/validate/playthrough.mjs). Boot with ALLOW_DEV_AUTH=1 + ALLOW_DEBUG_SCENARIOS=1, authenticate (266 JWT), deploy into this level-1, enable god-mode, reach + activate + defeat this level stage boss (use the correct debug scenario from game/server/debugScenarios.js; confirm boss enemy type from code). Capture screenshots (hub, level entry, mid-level, boss dormant, boss active, boss defeated/victory) under validation/<level>/ and write validation/<level>/findings.md noting anything broken/ugly/surprising. ASSERT boss spawns, encounter activates, boss hp->0, victory/objective complete. Asserts pass OR findings.md documents the real failure with screenshots (do NOT fake a pass). Workers cannot file beads - put everything in findings.md for operator triage. SCOPE: harness/validate/**, validation/** only; no gameplay code changes beyond a minimal justified test hook if unavoidable. Output dir: validation/open-plaza/.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
