# encounters: boss-encounter HUD never appeared in any tested Frost Crossing path

## Difficulty: medium

## Goal

During QA the stage-boss HP banner (#boss-encounter-hud, 'Stage Boss' + name + HP bar) never displayed on Frost Crossing tier 1: (a) on a natural run the encounter stayed phase 'dormant' (bot did not reach the ice_cairn landmark trigger, so inconclusive there); (b) via the 'frost-crossing-last-enemy' debug scenario the warden spawned and was killed, victory fired and encounter.phase went to 'cleared', but bossEncounter stayed null in client state and the HUD stayed hidden for the entire boss fight — i.e. the scenario path appears to skip the 'engaged' phase that drives the HUD, and the natural path could not be confirmed. Verify the landmark trigger actually flips the encounter to engaged and shows the HUD in a real playthrough; if the last-enemy/boss scenarios bypass engagement, fix them so captures exercise the real HUD.

## Acceptance Criteria

- A scripted or manual playthrough screenshot shows the boss-encounter HUD visible with the warden's name and a draining HP bar during the Frost Crossing tier 1 boss fight, in both the natural-trigger path and the debug-scenario path used by validation.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
