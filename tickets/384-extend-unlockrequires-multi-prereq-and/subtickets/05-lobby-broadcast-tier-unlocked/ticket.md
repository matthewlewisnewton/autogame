# 05 — Lobby broadcast tierUnlocked payloads

`lobbyJoined` already uses `buildQuestUpdatePayload`, but `emitQuestPayloadToLobby` and `broadcastLobbyUpdate` still spread `buildSharedQuestUpdatePayload` plus the raw `unlockedQuestTiers` map. Wire every account-scoped quest socket path so `questVariants[].tierUnlocked` is present on `questUpdate` and `lobbyUpdate` emissions.

## Acceptance Criteria

- `emitQuestPayloadToLobby` emits per-socket payloads whose `questVariants` include `tierUnlocked` computed via `isQuestTierUnlocked` (same as `buildQuestUpdatePayload`).
- `broadcastLobbyUpdate` emits per-socket `lobbyUpdate` payloads with the same account-scoped `questVariants[].tierUnlocked` fields.
- Raw `unlockedQuestTiers` remains on those payloads (persistence semantics unchanged); `tierUnlocked` is the evaluated AND-prereq gate.
- For a multi-prereq fixture account with persisted tier-2 unlock but only one prerequisite completed, `questUpdate`/`lobbyUpdate` show `tierUnlocked: false` on that variant while `unlockedQuestTiers` still lists the tier.
- `lobbyJoined` continues to include evaluated `tierUnlocked` (no regression).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/index.js`** — Refactor `emitQuestPayloadToLobby` and `broadcastLobbyUpdate` to merge account-scoped quest fields from `buildQuestUpdatePayload(state, player.accountId)` per socket instead of `buildSharedQuestUpdatePayload` + `unlockedQuestTiersForLobbyPlayer` alone. Keep shared lobby fields (`players`, `gamePhase`, `shopOffer`, etc.) as today; only the quest portion must carry evaluated variants.
- **`game/server/quests.js`** — Touch only if a small helper (e.g. exporting `listQuestVariantsForAccount`) keeps `index.js` DRY; do not change normalization or `isQuestTierUnlocked` logic.
- **`game/server/test/unlock_prereqs.test.js`** — Add socket-level coverage: connect client, trigger `lobbyUpdate`/`questUpdate`, assert multi-prereq `tierUnlocked` on emitted `questVariants`.
- **`game/server/test/quest_tier_lobby_sync.test.js`** — Extend or add a case asserting `questVariants` on `lobbyUpdate` include `tierUnlocked` consistent with per-account unlock state.

## Verification: code
