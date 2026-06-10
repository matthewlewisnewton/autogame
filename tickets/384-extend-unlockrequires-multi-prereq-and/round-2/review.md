## Runtime health

The captured round-2 run loaded cleanly enough to review the implementation. `metrics.json` reports `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` has Vite startup plus two `409 Conflict` resource loads, but no `pageerror` or `[fatal]` lines from game code. The probes show a connected two-player lobby, transition into gameplay, movement, and dodge-roll cooldown state.

The screenshot image files named in `metrics.json` are not present in the round-2 folder, so visual review is limited to the metrics/probe descriptions and logs. That is not the blocking issue here.

## Acceptance criteria

### Extend `unlockRequires` to accept multiple prerequisites with AND logic

The schema and normalization path now accept both the legacy single-object form and an array form. `game/server/quests.js` has `normalizeUnlockRequires()`, preserves array `unlockRequires` through `getQuest()` / `listQuestVariants()`, and the new tests cover invalid-entry filtering and single-object compatibility.

However, the implementation does not robustly support the ticket's stated use case of gating levels behind completing level 2 of a combination of other stages. `game/server/users.js` defines quest-tier completion as "there is a persisted unlock for a higher tier." That works for a tier-1 prerequisite because completing tier 1 persists tier 2, but it cannot work for current tier-2 quests: there is no valid tier 3 to persist, `unlockQuestTier()` rejects unknown tiers, and `game/server/progression.js` only records tier-2 unlocks after tier-1 victories. A future authored requirement such as:

```js
unlockRequires: [
  { questId: 'training_caverns', tier: 2 },
  { questId: 'crystal_rescue', tier: 2 },
]
```

will remain locked after players actually clear both tier-2 stages through normal gameplay. The current tests only cover tier-1 prerequisites and manually pre-persist the target tier before evaluating the AND prerequisites, so they do not exercise the normal player path required by the ticket.

### Update `isQuestTierUnlocked`

Partially satisfied, but blocked by the completion-model issue above. `isQuestTierUnlocked()` now evaluates all normalized prerequisites with AND semantics after confirming the target tier is present in the persisted unlock map. For legacy tier-2 unlocks that require the same quest's tier 1, this remains backward-compatible. For tier-2 prerequisite combinations, normal gameplay cannot create the completion evidence the helper requires.

### Update quest payloads to evaluate and expose multi-prereq unlocks

Mostly satisfied for emitted quest payloads. `buildQuestUpdatePayload()` now emits per-account `questVariants[].tierUnlocked`, and lobby/quest update broadcasts call it per socket so one player's unlock map does not leak to another. The client quest board prefers `tierUnlocked` over the raw `unlockedQuestTiers` fallback.

This still inherits the same blocking false-negative for any prerequisite that asks for completion of tier 2, because the server-side evaluation cannot observe tier-2 completion.

### Backward compatibility

Legacy single-object `unlockRequires` remains supported. Existing tier-2 flows that unlock after their own tier-1 completion are covered by tests and by the unchanged persisted unlock map shape.

## Design and foundation consistency

The change is consistent with the quest-board, lobby, and server-client architecture described in `CONTEXT.md` and `game/docs/design.md`. It does not alter rendering, movement, multiplayer connection, combat, or dungeon runtime behavior from `game/docs/requirements.md`; the round-2 capture confirms the game still starts, connects clients, renders gameplay, and processes movement/key-item input.

No new development debug scenario was added or changed for this ticket.

## Code quality and validation

The implementation is locally scoped to quest definitions, account unlock helpers, quest payload broadcast, quest-board lock rendering, and focused tests. The round-2 coverage log reports `134 passed` test files and `2199 passed` tests. The main missing coverage is a normal-flow integration test for an authored array prerequisite containing `{ tier: 2 }`, where clearing all prerequisite tier-2 runs should make the dependent quest selectable.

## Remaining gaps

1. Multi-prereq unlocks cannot be satisfied by completing tier-2 prerequisite stages through normal gameplay. The code infers "completed tier N" from an unlocked tier greater than N, but current tier-2 quests have no valid tier 3 and tier-2 victories do not persist completion state. This blocks the ticket's stated goal of gating levels behind completing level 2 of a combination of other stages.

VERDICT: FAIL
