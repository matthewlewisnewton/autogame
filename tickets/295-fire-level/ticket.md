# 295-fire-level

## Difficulty: hard

## Goal

Add a new FIRE LEVEL: a fire/lava-themed layout profile wired via getLayoutProfileForQuest + generateLayout(seed, "fire-...") (mirror sunken-canyon/spire-ascent), with a quest + tier-1 and a debug scenario to deploy straight in. Themed visuals/lighting. (No new floor physics required — the ice level owns the slippery-floor work.) Fire enemies + spawns are wired in 296.

ACCEPTANCE: the fire level is reachable via its quest and via a debug scenario; layout generates correctly; floor alignment correct; basic render verified. SCOPE: game/server (quests/layout/profile + debug scenario), game/client (theme), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
