# 372-playthrough-validate-ice-level

## Difficulty: hard

## Goal

NEW LEVEL first validation of the ICE LEVEL (292) and its slippery-floor physics. Add an ice-level preset plus debug scenarios to the playthrough driver (mirror existing per-level presets). Deploy into the ice level and test: slippery-floor momentum/low-friction movement (accelerate, release input and confirm slide/momentum, direction changes, transitions between normal and ice floor), the ICE ENEMY (293) ice balls that slow the player on hit, and a stage boss if one exists (if the ice level has no boss/encounter yet, NOTE that gap in findings). Re-validation playthrough reusing the 277-281 driver (game/validate; boots ALLOW_DEV_AUTH=1 + ALLOW_DEBUG_SCENARIOS=1, god-mode, reach and defeat the stage boss, capture screenshots + findings.md). Exercise NEW content and report anything broken: boss health-bar/encounter UI (283), distinct boss visuals (284), a slow card and a burn card (confirm slow/burn apply and are mutually exclusive per 301), a heal/cleanse card (299), a wind-up card (308 input-lock + charge telegraph), telepipe-up vitals persistence (287) and card-charge reset on new sortie (289). Capture screenshots per stage and write findings.md listing EVERY bug/glitch/oddity (visual, functional, timing, new-content interactions). Workers cannot file beads, so put all findings in findings.md for operator triage. Asserts pass OR findings.md documents the real failure with screenshots (do not fake green). Output dir: game/validation/ice/. SCOPE: game/validate + game/validation/ice outputs.

## Verification

reconcile: orphaned in_progress on dispatcher startup
composer_write failed (rc=-15)
