# 286-playthrough-driver-output-quality-findings-victory-path

## Difficulty: medium

## Goal

Found reviewing playthrough-validation outputs (277/278/279). The headless validation driver has output-quality bugs:

1. findings.md NOT parameterized per level: validation/open-plaza/findings.md is headed "# Rooms validation findings" and lists the boss as "annex_overseer" (copied from rooms) when open-plaza boss is arena_champion (run-summary.json confirms). Parameterize the report header + asserted boss name from the preset.
2. Victory screenshot is a byte-identical DUPLICATE of boss-defeated: validation/open-plaza/06-boss-defeated.png and 07-victory.png have the same md5 (8e430a9f...). The driver did not capture a distinct victory frame — it must wait for the "Sortie Complete" screen before the victory capture.
3. Inconsistent artifact location: 278 wrote to repo-root validation/open-plaza/ while 277 (rooms) and 279 (sunken-canyon) wrote to game/validation/<level>/. Standardize on game/validation/<level>/ (277 sub-ticket 19 deliberately relocated under game/).

DO: fix the shared driver so every level produces a correctly-parameterized findings.md, a genuinely distinct victory screenshot, and writes under game/validation/<level>/. Re-running open-plaza to regenerate correct artifacts is in scope. SCOPE: the playthrough driver (game/validate or harness/validate) + game/validation/** outputs.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
