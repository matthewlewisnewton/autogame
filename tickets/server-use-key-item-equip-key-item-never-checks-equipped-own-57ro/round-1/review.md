# Senior Review: Server USE_KEY_ITEM / EQUIP_KEY_ITEM ownership checks

**Ticket:** `server-use-key-item-equip-key-item-never-checks-equipped-own-57ro`  
**Baseline:** `5ee37d4c428cc61988fb6e26e0a8425bf5209c7e`  
**Commits:** `7eb5b31b` (USE_KEY_ITEM equipped check), `4ff1fd5c` (EQUIP_KEY_ITEM unlock check)

## Runtime health

Captured run is clean:

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (also confirmed in `pageerrors.json`) |
| `harness_failure` | absent |
| `console.log` `pageerror` / `[fatal]` | none |

`console.log` shows normal Vite connect noise and a 409 on an auth resource (benign harness username collision). Scene initialized, lobby → gameplay transition succeeded, dodge roll fired with cooldown HUD (`keyItemCooldownRemaining: 382` in probe, `keyItemIndicatorOnCooldown: true` in screenshot probe). Game starts and loads cleanly.

## Acceptance criteria

### 1. USE_KEY_ITEM rejects when `keyItemId` is not the equipped key item

**Met.** `handleUseKeyItem` in `game/server/keyItemEffects.js` adds an equipped-item guard immediately after the `getKeyItemDef` check and before the cooldown check:

```89:93:game/server/keyItemEffects.js
    // Ownership check: the requested key item must match what the player has equipped
    if (keyItemId !== player.equippedKeyItemId) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, { ok: false, reason: 'not_equipped' });
      return;
    }
```

Guard order is correct: phase/dead/extracted/card-commitment → missing/unknown id → **not_equipped** → cooldown → effect branches. A mismatch returns early with no cooldown burn and no state mutation (verified in test).

New test `useKeyItem is rejected when keyItemId does not match equipped key item with not_equipped reason` in `game/server/test/key-items.test.js` covers the rejection path (`dodge_roll` equipped, `overclock` requested).

### 2. EQUIP_KEY_ITEM validates ownership/unlock

**Met.** `game/server/socketHandlers/keyItemHandlers.js` calls `isKeyItemUnlocked(player, keyItemId)` after the known-def guard and before mutating `equippedKeyItemId`:

```28:31:game/server/socketHandlers/keyItemHandlers.js
    if (!isKeyItemUnlocked(player, keyItemId)) {
      socket.emit(SERVER_TO_CLIENT.KEY_ITEM_ERROR, { reason: 'not_unlocked' });
      return;
    }
```

`isKeyItemUnlocked` in `game/server/progression.js` is the canonical unlock hook. Today it returns `keyItemId in KEY_ITEM_DEFS` (all 14 items unlocked at start, matching existing `getUnlockedKeyItems()` behavior and sub-ticket spec). A `setTestKeyItemUnlockOverride` test hook allows deterministic `not_unlocked` coverage without changing production unlock rules.

New test `equipping a locked key item is rejected with not_unlocked reason` mocks the override, asserts `keyItemError` with `reason: 'not_unlocked'`, and confirms `equippedKeyItemId` is unchanged.

### 3. Existing key-item tests pass plus new rejection-path tests

**Met.** Harness `coverage.log` run completed successfully. Independent verification: `pnpm test:quick` — **225 files, 3321 tests passed**.

All key-item integration tests that emit `useKeyItem` for a specific item were updated to set `player.equippedKeyItemId` to match (barrier_dome, guard_block, field_medic_kit, loot_magnet, phase_step, purge_charm, smoke_bomb, overclock, etc.). Tests that use the default loadout (`dodge_roll`) need no change. Integration dodge-roll test still passes via default `equippedKeyItemId: 'dodge_roll'`.

## Design & requirements consistency

- **Security model:** Server-authoritative validation closes the reported exploit: a modified client can no longer rotate the full key-item kit on one cooldown track by spoofing `keyItemId` on `USE_KEY_ITEM`. Equip path is gated for future per-player unlock progression.
- **`game/docs/design.md`:** No conflict. Key items remain lobby-equip / in-run-use abilities; no design doc changes required.
- **`game/docs/requirements.md`:** No regression to foundation (connect, render, movement, sync all exercised in capture).

## Code quality

- Minimal, focused diff (~180 lines, mostly test fixture updates).
- Checks reuse existing patterns (`getKeyItemDef`, `isKeyItemUnlocked`, `SERVER_TO_CLIENT` error shapes).
- Test override is scoped (`setTestKeyItemUnlockOverride(null)` in `finally`) and exported only for test access via `index.js`, consistent with other server test hooks.
- No dead code, no client changes required (client already emits `me.equippedKeyItemId` in `main.js`).

## Debug scenarios

This ticket did not add or modify `?debugScenario=` shortcuts. Existing debug scenarios (e.g. `summon-recall`) set `equippedKeyItemId` explicitly before key-item use — compatible with the new guard. No debug-scenario blocking issues.

## Capture alignment

Fallback smoke capture exercised the real player path: auth → lobby → ready → WASD movement → dodge roll (E). Probes confirm `equippedKeyItemId: "dodge_roll"`, successful dodge cooldown activation, and clean reconnect to ready state. Screenshots show lobby and in-run HUD with Dodge Roll indicator.

## Remaining gaps

None. All acceptance criteria are fully met; runtime capture is clean; test suite is green.

VERDICT: PASS
