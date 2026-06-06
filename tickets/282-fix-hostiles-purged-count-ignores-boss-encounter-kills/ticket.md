# 282-fix-hostiles-purged-count-ignores-boss-encounter-kills

## Difficulty: medium

## Goal

Found by the Rooms playthrough-validation (277). The end-of-run victory screen "Sortie Complete" reports "Hostiles purged: 0" even though the run defeated the stage boss (Annex Overseer) AND its adds, with server assertions bossDefeated=PASS and victoryFired=PASS.

EVIDENCE (committed on main): game/validation/rooms/07-victory.png (shows "Hostiles purged: 0", "Money collected: 10"); game/validation/rooms/run-summary.json (bossDefeated/victoryFired PASS; boss annex_overseer hp 320 -> defeated).

The run-end "hostiles purged" / kill counter is not crediting stage-boss + encounter-add defeats. NOTE: the validation reaches the boss via debug scenarios (training-caverns-boss-low-hp etc.) and a god-mode run, so confirm whether the miss is (a) the boss/encounter defeat path never incrementing the counter (real player-facing bug), or (b) only the debug/insta-defeat path bypassing it. Fix so defeating the boss + encounter adds is reflected in the run-summary kill count. Add/extend a server test asserting an encounter boss+adds defeat increments the purged count.

SCOPE: game/server (kill/summary accounting) + game/server/test. Minimal client change only if the count is computed client-side.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
