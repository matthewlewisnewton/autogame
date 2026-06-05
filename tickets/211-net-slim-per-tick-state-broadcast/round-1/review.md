## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `"ok": true`, includes live lobby-to-gameplay probes, and has an empty `pageerrors` array. `console.log` contains only Vite connection/resource noise and normal scene initialization; there are no `pageerror` or `[fatal]` lines from game code. `client.log` only shows benign THREE deprecation warnings and Vite websocket close noise, and `server.log` shows normal startup, connections, and disconnects.

## Acceptance criteria findings

1. Split hot per-tick `stateUpdate` from cold per-player data: satisfied. The live server now builds `hotStateSnapshot()` in `game/server/progression.js` with position, hp, combat/status flags, enemies, minions, loot, run/lobby, quest, layout seed, shop, telepipe, and suspended-run summary fields. The 20Hz loop in `game/server/index.js` emits this hot snapshot from `runGameLoopTick()`, while the full `stateSnapshot()` remains available for one-shot full syncs and transition paths. Tests assert tick-emitted `stateUpdate` omits `deck`, `hand`, `inventory`, `ownedCards`, `selectedDeck`, `runRewards`, `returnRewardsPreview`, `inDesperation`, `nextDrawAt`, and related cold fields while server state retains them.

2. Hoist lobby-level computes and stop hot-path inventory cloning: satisfied. `ensureShopOffer()` and `buildSuspendedRunSummary()` are computed once per snapshot and shared through `buildWorldSnapshot()`. `stateSnapshot()` no longer deep-clones inventory per player, and the periodic path no longer includes inventory at all.

3. Cold state changes use existing reconciliation events without UI desync: satisfied. `emitPlayerDeckUpdate()` sends in-run `deckUpdate` payloads with `deck`, `hand`, `desperationDeck`, `inDesperation`, `nextDrawAt`, and reward preview data to the owning socket. Hand/deck mutation helpers call it for opening hands, passive draws, discards, exhausted cards, and card effects. Existing lobby collection mutations continue through `deckUpdate` or `cardInventoryUpdate`. The client `stateUpdate` handler in `game/client/main.js` guards all cold-field reads and preserves last-known collection/hand data when slim ticks omit those fields; the `deckUpdate` handler applies in-run hand, draw pile, desperation, HUD, and deck-visual updates. The capture probes show no hand, deck, inventory, or cooldown HUD desync after deploy, movement, and dodge cooldown.

4. Design and foundation consistency: satisfied. The changes preserve the documented lobby-to-dungeon multiplayer loop and do not alter combat, movement, dungeon generation, authentication, or rendering foundations. The captured run still renders the Three.js scene, connects two players over sockets, transitions from lobby to dungeon, synchronizes movement, and updates HUD state.

5. Debug scenarios: no ticket-added debug scenario was found. Existing debug-scenario usage remains test-only/socket-driven and was not introduced as a normal gameplay entry point by this ticket.

## Verification notes

The branch includes focused server and client tests for the new split: tick payload shape, in-run `deckUpdate`, and client reconciliation for slim playing updates. The supplied `coverage.log` completed 1163 passing tests and 1 failing test in `server/test/account.test.js` where `/api/register` returned 500 instead of 201 for the unrelated `modelUser` account profile test. I did not find an intersection between that failure and this ticket's changed files or runtime behavior, and the live capture demonstrated successful auth/lobby/gameplay flow.

## Remaining gaps

No blocking gaps remain for this ticket.

VERDICT: PASS
