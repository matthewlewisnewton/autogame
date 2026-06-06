# 292-ice-level-and-slippery-floor-physics

## Difficulty: hard

## Goal

Add a new ICE LEVEL plus a new SLIPPERY/ICE FLOOR type. There is currently NO floor-friction/momentum system, so this introduces it.

ICE LEVEL: a new ice-themed layout profile (wire via getLayoutProfileForQuest + generateLayout(seed, "ice-..."), mirroring how sunken-canyon / spire-ascent were added) with a quest + tier-1, and a debug scenario to deploy straight into it.

SLIPPERY FLOOR: a floor/tile type where players have LOW FRICTION / high momentum — input accelerates the player but releasing input lets them keep sliding/decelerate slowly (carry momentum), versus normal floors where they stop quickly. Server-authoritative movement (game/server/simulation.js) with a client feel that matches.

TEST THOROUGHLY (explicit owner ask): server tests covering acceleration onto ice, momentum carry after input release, deceleration curve, direction changes while sliding, transitions between normal<->slippery floor, and edge cases (wall collision while sliding, standing still). SCOPE: game/server/simulation.js (movement physics), game/server/dungeon.js + quests/layout (ice profile), game/client (floor render + feel), game/*/test. NOTE: ice enemies + spawns are wired in 293.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
