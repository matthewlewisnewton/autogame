# 05 — Per-account quest unlock payloads

Stop broadcasting one player's `unlockedQuestTiers` to the entire lobby. Emit account-specific unlock maps on quest/lobby updates and after a Tier-1 victory so each client immediately reflects its own unlock state.

## Acceptance Criteria

- `selectQuest` broadcasts shared quest/layout fields to the lobby room but sends `unlockedQuestTiers` only to each socket using that socket's `accountId` (not the selecting player's map room-wide).
- `broadcastLobbyUpdate` (and `emitLobbyJoined`) attach `unlockedQuestTiers` per recipient socket; room-wide `lobbyUpdate`/`questUpdate` payloads never contain another account's unlock map.
- After a Tier-1 victory, when the squad returns to lobby (`returnToLobby` → `returnPlayersToLobby`), each account that earned the unlock receives an updated `unlockedQuestTiers` payload without reconnecting.
- Two-client socket test: player A (unlocked) selects Tier 2; player B (locked) receives a quest/lobby payload whose `unlockedQuestTiers` omits `training_caverns: [2]` (or equivalent empty map for that quest).
- Two-client or single-client socket test: after clearing Tier 1, the winning account's client receives Tier-2-unlocked map on lobby return and can select Tier 2.
- `game/server/test/quest_tier_lobby_sync.test.js` (new) or extended `quest_tier_gating.test.js` covers the cases above; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/index.js`** — Add a helper (e.g. `emitQuestPayloadToLobby(lobby, extraFields?)`) that:
  - builds a shared payload from `buildQuestUpdatePayload(state)` **without** `unlockedQuestTiers`;
  - iterates lobby player sockets via `findSocketByPlayerId` and emits `questUpdate` / `lobbyUpdate` with `...shared, unlockedQuestTiers: getUnlockedQuestTiers(accountId)`.
  - Use it in `selectQuest`, `broadcastLobbyUpdate`, and anywhere else that currently spreads `buildQuestUpdatePayload(state, oneAccountId)` to `io.to(lobby.id)`.
- **`game/server/quests.js`** — Optionally split `buildQuestUpdatePayload` into shared catalog/selection fields vs account unlock attachment so callers cannot accidentally include unlocks in room broadcasts.
- **`game/server/progression.js`** — After Tier-1 victory unlock writes in `checkRunTerminalState`, ensure lobby return triggers per-account quest sync (via the index helper or an injected callback) so `returnPlayersToLobby` clients are not left with stale unlock UI.
- **`game/server/debugScenarios.js`** — Update `quest-tier-2-unlocked` (and any similar paths) to use the per-socket emission helper instead of `io.to(lobby.id).emit('questUpdate', payloadWithOneAccountUnlocks)`.
- **`game/client/main.js`** — Only if needed after server fix: apply `unlockedQuestTiers` from `runComplete` or ensure `lobbyUpdate` after `stateUpdate` on lobby return refreshes the quest board (prefer fixing server emission first).
- Do **not** change ready/deploy tier enforcement here (sub-ticket 06).

## Verification: code
