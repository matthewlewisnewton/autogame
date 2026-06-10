# 388-level-map-unlock-graph-data-api

## Difficulty: medium

## Goal

Expose the full LEVEL UNLOCK GRAPH to the client for the level-select map: every quest node (level-1, level-2, AND boss levels), each node's unlockRequires (the multi-prereq array from 384), and per-player locked/unlocked/cleared state, as one payload. SCOPE: game/server/quests.js + game/server (payload) + test. DEPENDS ON 384.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
