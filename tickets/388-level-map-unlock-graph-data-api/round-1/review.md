## Runtime health

The captured game run is clean. `metrics.json` reports `"ok": true`, the page loaded into gameplay with connected sockets and an initialized scene, and `pageerrors` is empty. `console.log` contains only Vite connection messages and scene initialization logs; the client/server logs show no uncaught page errors or fatal game-code errors. The benign Three.js deprecation and Vite socket-close noise in `client.log` do not block the ticket.

## Acceptance criteria

`buildLevelUnlockGraph(accountId)` is exported from `game/server/quests.js` and returns `{ nodes: [...] }` with one node per quest tier by iterating the same `QUEST_DEFS` tier order as `listQuestVariants()`. Each node includes `questId`, `tier`, `name`, `objectiveType`, `isBoss`, normalized `unlockRequires`, and a `state` string.

The state calculation matches the requested precedence: `cleared` from `hasCompletedQuestTier`, otherwise `unlocked` from `isQuestTierUnlocked`, otherwise `locked`. Because `isQuestTierUnlocked` treats valid tier-1 quests as unlocked before user lookup and higher tiers require an account plus persisted/prerequisite unlocks, falsy or unknown accounts produce unlocked tier-1 nodes, locked higher-tier nodes, and no cleared nodes.

Boss and prerequisite data are represented correctly. `isBoss` is derived from `objectiveType === 'stage_boss'`, which includes both tier-2 boss variants and tier-1 boss quests such as Frost Crossing, and `unlockRequires` is run through `normalizeUnlockRequires`, preserving single prereqs as one-element arrays and multi-prereq AND arrays as authored.

`buildQuestUpdatePayload(gameState, playerAccountId)` now includes `levelUnlockGraph: buildLevelUnlockGraph(playerAccountId)` in the existing per-account payload block. The same payload is already spread into `questUpdate`, `lobbyUpdate`, and lobby-join payloads, so the client receives the graph in the established quest payload path without a new event or endpoint. Account-less payloads still omit the per-player graph, which matches the subticket allowance and the existing `unlockedQuestTiers` behavior.

## Design and regression check

The change is server-side data exposure only. It does not alter quest selection, tier gating, unlock persistence, combat, movement, rendering, or the lobby/dungeon loop described in `game/docs/design.md`, and it does not regress the foundational requirements for rendering, WebSocket connectivity, multiplayer visualization, or movement synchronization.

## Tests and coverage

The added `game/server/test/level_unlock_graph.test.js` covers graph cardinality, boss flags, normalized prerequisites, default unauthenticated states, cleared/unlocked progression state, payload inclusion for accounts, and omission without an account. The round coverage run passed: 22 test files and 914 tests.

## Remaining gaps

None.

VERDICT: PASS
