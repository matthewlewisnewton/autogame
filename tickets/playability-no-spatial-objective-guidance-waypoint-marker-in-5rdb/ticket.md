# playability: no spatial objective guidance (waypoint/marker) in maze-like 'open' layouts — collect-item/find-room quests require blind exploration

## Difficulty: medium

## Goal

Repro from cold start (server ALLOW_DEV_AUTH=1 ALLOW_DEBUG_SCENARIOS=1 PORT=3310; client vite 5310):
1. Register, log in, create lobby, deploy 'crystal_rescue' t1 (objectiveType=collect_items, itemCount=3, layoutProfile='open').
2. Try to complete it as a new player.

OBSERVED: The 'open' layout is a maze of walls/rooms (see harness/tmp/playqa2/cnav-pushx.png). The 3 resonance prisms spawn scattered across non-start rooms (game/server/progression.js spawnCrystals ~line 2793: treasure + shuffled combat rooms). Crystals are auto-collected on proximity (client emits LOOT_PICKUP within LOOT_PICKUP_RADIUS=3.5; game/client/renderer.js ~1895). The objective HUD (#objective-hud) only shows TEXT progress ('0/3 prisms'); there is NO on-screen waypoint/marker/compass/minimap pointing to where the prisms or the unexplored rooms are (no nav indicator found in objectiveHud.js/main.js/renderer.js).

IMPACT: In the maze-like open layouts a new player has no spatial cue where to go to find the prisms or the next objective; they must wander blindly. This is significant friction for collect_items quests and 'find/reach' objectives and contributes to the game feeling unplayable for a first-time player who clears the visible enemies but then cannot tell the run isn't over or where to go next.

EXPECTED: some directional/spatial guidance to objective items / next room (waypoint arrow, ping, or minimap) — at least for quest-critical loot like prisms.

NOTE: non-blocking (the run is still completable by exploring), filed as UX/guidance. Verified manually with godmode navigation; movement/collision itself works (walls are normal maze geometry, not a collision bug).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
