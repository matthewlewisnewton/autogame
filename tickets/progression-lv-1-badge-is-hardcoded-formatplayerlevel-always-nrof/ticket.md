# progression: 'LV 1' badge is hardcoded — formatPlayerLevel() always returns 1, no player leveling exists

## Difficulty: hard

## Goal

The vanguard HUD portrait shows a 'LV 1' level indicator, but game/client/vanguard-hud.js formatPlayerLevel() is literally 'return 1;'. There is no player XP or level system server-side (progression is card grind levels + money only) — across a full QA playthrough with dozens of kills, victories, and card rewards the badge never moved. The HUD element implies a progression system that does not exist, which reads as broken progression to players. Either implement player XP/levels (kills/quest completions feeding a level that gates something meaningful — e.g. tier-2 unlock pacing) or remove the badge until the system exists.

## Acceptance Criteria

- Either: player level is a real server-tracked stat that increases through play, is displayed in the HUD, and is covered by tests; or: the LV badge is removed from the portrait frame and no dead level UI remains.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
