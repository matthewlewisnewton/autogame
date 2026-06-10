# Senior Review: 384-extend-unlockrequires-multi-prereq-and

## Runtime Health

PASS. The round-3 capture proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, server/client startup completed, and `pageerrors` is empty. `console.log` has no `pageerror` or `[fatal]` entries from game code. The only notable browser-console errors are 409 resource responses during auth/setup, and the game continues into a two-player lobby and active run. The probes show connected clients, initialized scene/canvas, playing phase, active objective state, movement, and Dodge Roll cooldown HUD behavior.

## Acceptance Criteria Findings

### `unlockRequires` Supports Multiple Prerequisites With AND Logic

PASS. `game/server/quests.js` now accepts both the legacy single-object form and the new array form through `normalizeUnlockRequires()`. Invalid entries are dropped, empty/all-invalid inputs normalize to no prerequisites, and valid arrays preserve their authored order for payload exposure. Server tests cover null, invalid, single-object, and array normalization, plus preservation through `getQuest()` and `listQuestVariants()`.

### `isQuestTierUnlocked` Evaluates Multi-Prerequisite Unlocks

PASS. `game/server/users.js` now evaluates every normalized prerequisite with AND semantics via `areUnlockPrereqsMet()` and `hasCompletedQuestTier()`. Backward compatibility is preserved because single-object `unlockRequires` normalizes to a one-entry prerequisite list, and existing tier-2 unlock behavior still works for the current catalog. Socket selection, readiness, and deploy checks all continue to call `isQuestTierUnlocked()`, so locked tiers are enforced server-side rather than only in the UI.

### Quest Payload Exposes Evaluated Unlock State

PASS. `buildQuestUpdatePayload()` now emits account-specific `questVariants` with `tierUnlocked` computed by `isQuestTierUnlocked()`, while still carrying the legacy `unlockedQuestTiers` map. Lobby join, lobby update, and quest update emissions build payloads per player account, so multi-player lobbies do not leak one account's evaluated unlock state to another. The client quest board prefers `variant.tierUnlocked` when present and only falls back to `unlockedQuestTiers` for older/accountless payloads.

### Completion Persistence Enables Tier-2 Prerequisites

PASS. The implementation adds persisted `completedQuestTiers` and records tier-1 completion on tier-1 victory plus tier-2 completion on tier-2 victory. This is necessary for prerequisites such as `{ questId, tier: 2 }`, where unlocking tier 2 alone is not enough to prove that tier 2 has been completed. Tests cover persistence, reload/backfill behavior, and a normal-flow fixture where a target tier remains locked until both prerequisite tier-2 victories have been recorded.

### Design And Foundation Consistency

PASS. The changes stay within the lobby/quest progression model described in `game/docs/design.md`: players select quests in the lobby, ready up, deploy, and progression is awarded after successful dungeon objectives. The foundation requirements are not regressed; the captured run confirms WebSocket connection, multiplayer visualization/state, 3D rendering, and movement in an active run.

### Debug Scenarios

PASS. This ticket did not add or change a development `?debugScenario=` shortcut. The changed behavior is exercised through normal account progression, quest selection, readiness, and run-completion paths rather than relying on a debug-only entry point.

## Code Quality And Verification

The live codebase is coherent with the ticket scope. The implementation is server-authoritative for selection/readiness gating, keeps account-specific payloads isolated per socket, and updates the client lock UI without trusting the raw legacy unlock map when evaluated `tierUnlocked` is available.

Verification observed:

- Round-3 runtime capture: `ok: true`, empty `pageerrors`, no fatal console entries.
- `coverage.log`: 151 test files passed, 2328 tests passed.
- Changed code inspected from `git diff 00815f732b26c7eecfaa2d64a1ffd2a8cf8c37a4 HEAD`.

## Remaining gaps

None.

VERDICT: PASS
