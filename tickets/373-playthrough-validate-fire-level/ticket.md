# 373-playthrough-validate-fire-level

## Difficulty: hard

## Goal

NEW LEVEL first validation of the FIRE LEVEL (295). Add a fire-level preset plus debug scenarios to the playthrough driver. Deploy into the fire level and test: the FIRE ENEMY (296) lighting the player on fire (burning DoT plus animation), burning ticking damage, and a stage boss if one exists (if none yet, NOTE the gap in findings). Re-validation playthrough reusing the 277-281 driver (game/validate; boots ALLOW_DEV_AUTH=1 + ALLOW_DEBUG_SCENARIOS=1, god-mode, reach and defeat the stage boss, capture screenshots + findings.md). Exercise NEW content and report anything broken: boss health-bar/encounter UI (283), distinct boss visuals (284), a slow card and a burn card (confirm slow/burn apply and are mutually exclusive per 301), a heal/cleanse card (299), a wind-up card (308 input-lock + charge telegraph), telepipe-up vitals persistence (287) and card-charge reset on new sortie (289). Capture screenshots per stage and write findings.md listing EVERY bug/glitch/oddity (visual, functional, timing, new-content interactions). Workers cannot file beads, so put all findings in findings.md for operator triage. Asserts pass OR findings.md documents the real failure with screenshots (do not fake green). Output dir: game/validation/fire/. SCOPE: game/validate + game/validation/fire outputs.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
