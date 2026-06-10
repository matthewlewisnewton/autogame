# 389-level-select-tree-map-ui

## Difficulty: hard

## Goal

Build the LEVEL-SELECT MAP: a tree/graph screen (fronting the Quest Board selection; lobby-finder stays a menu) that renders the unlock graph from 388. Draw a BOX per node for each level's LEVEL-1, LEVEL-2, AND BOSS LEVELS. Lay nodes out left-to-right by prerequisite depth (requirements as leaves on the left). Draw EDGES from each level to the levels that require it (gated boss levels show their multiple requirement edges converging). Style nodes locked/unlocked/cleared; clicking an unlocked node selects that level/tier to play. DEPENDS ON 388. SCOPE: game/client (level map UI) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
