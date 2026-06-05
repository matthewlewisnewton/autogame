## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `ok: true`, the dev servers started, `pageerrors` is empty, and `pageerrors.json` is empty. `console.log` contains only Vite connection messages, a 409 resource response, and scene initialization; there are no `pageerror` or `[fatal]` lines from game code.

## Acceptance criteria findings

### A quest exposes a Tier-2 variant

Partially satisfied. `training_caverns` now exposes tier 1 and tier 2 catalog entries, and the tier-2 row includes unlock metadata. The tier is carried into quest resolution, layout seed selection, run creation, state snapshots, lobby summaries, and run summaries.

### Tier-2 is unlockable only after beating Tier-1

Partially satisfied. Direct `selectQuest` attempts for tier 2 are server-gated by `isQuestTierUnlocked`, and a tier-1 victory records a tier-2 unlock for in-run player accounts. However, the gate is not robust at the lobby/run boundary: quest selection is lobby-wide, but tier access is validated only for the socket that sends `selectQuest`. Once any unlocked player selects tier 2, locked squadmates can ready into the same tier-2 run without their own account unlock being checked.

There is also a per-client payload issue. `selectQuest` broadcasts a `questUpdate` to the entire lobby using the selecting player's `unlockedQuestTiers`, so locked clients can receive another account's unlock map and render Tier 2 as selectable. Conversely, after a tier-1 victory, `runComplete` does not include updated unlocks, and `returnPlayersToLobby`/`broadcastLobbyUpdate` builds quest payloads without a player account id, so the winning client can keep rendering Tier 2 as locked until reconnecting or receiving a later account-specific payload.

### Unlock persists

Satisfied. The account model backfills `unlockedQuestTiers`, new users start with `{}`, `unlockQuestTier` persists tier 2 idempotently, and the focused persistence test confirms unlocks survive reload from disk.

### Selection UI surfaces Tier-2 once unlocked

Not satisfied. The quest board can render locked and unlocked tier-2 rows when given the correct `unlockedQuestTiers` map, but the live socket flow does not reliably send the newly unlocked account-specific map to the client after a normal tier-1 clear. Because the client only updates `unlockedQuestTiers` when that field is present, the board remains stale after the actual unlock event.

### Tests for unlock gating

Mostly satisfied. Focused ticket tests passed locally:

- `server/test/quests.test.js`
- `server/test/quest_tier_unlock_persistence.test.js`
- `server/test/quest_tier_gating.test.js`
- `client/test/questBoard.test.js`

The round `coverage.log` shows the full coverage run had one unrelated failure in `server/test/account.test.js` during registration (`expected 500 to be 201`) caused by a `users.json.tmp` rename race. That is not the tier-gating acceptance failure, but it is a residual test-suite reliability issue.

## Design and requirements consistency

The implementation keeps the existing lobby-to-dungeon loop intact and does not regress the foundation requirements: the capture entered a multiplayer lobby, started gameplay, rendered the scene, maintained socket connection state, and movement/key-item probes succeeded. The tier plumbing is consistent with the design direction of selecting contracts in the lobby before deploying, but the account-specific unlock state needs to be kept account-specific when broadcast to clients.

## Debug scenarios

This ticket adds `quest-tier-2-unlocked`, gated through the existing `?debugScenario=` socket path. The shortcut stays in the lobby, persists the same unlock that normal tier-1 victory writes, selects the tier-2 quest, and refreshes layout/quest UI. The same end state is reachable through normal gameplay by clearing tier 1 once, so the scenario is acceptable as a QA shortcut.

## Remaining gaps

1. Account-specific tier unlock state is not propagated or enforced robustly across lobby clients. Newly unlocked players do not reliably see Tier 2 immediately after a normal tier-1 victory, locked clients can receive another player's unlock map, and locked squadmates can enter a tier-2 run selected by an unlocked player.

VERDICT: FAIL
