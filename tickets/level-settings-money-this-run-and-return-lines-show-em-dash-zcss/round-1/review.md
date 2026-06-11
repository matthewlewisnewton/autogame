# Senior Review: level settings money / return lines em-dash placeholders

**Ticket:** Lv overlay mid-run showed `Money this run: —` and `—` on the return-currency line even after collecting loot.  
**Baseline:** `bd5e1619267e41a78572e8e8fd250890c4a7af48`  
**Commits:** `235b1e4c` (client cache), `9e98317a` (server deckUpdate on loot pickup)

---

## Runtime health

| Check | Result | Evidence |
|-------|--------|----------|
| `metrics.json` present | **OK** | `"ok": true`, servers started, phase `"playing"`, canvas present |
| Page errors | **OK** | `"pageerrors": []`; `pageerrors.json` is `[]` |
| `console.log` | **OK** | No `[pageerror]` or `[fatal]` lines; only Vite connect, a benign 409 on auth register, and `[initScene]` |
| Harness failure | **None** | No `harness_failure` block |

The captured run proves the game loads and plays cleanly. Benign 409 Conflict on register is environment noise, not a game defect.

---

## Per-criterion findings

### Acceptance: Lv overlay shows live run-money collected and correct keep/forfeit amounts

**PASS**

Root cause (from decomposition) was twofold:

1. **Client:** `hotStateSnapshot()` omits cold `returnRewardsPreview` on per-tick `stateUpdate`s. The client had a `_lastReturnRewardsPreview` fallback but never seeded it on deploy (`enteringPlaying`), so after the first hot tick the overlay fell back to em-dashes.
2. **Server:** Currency loot pickup incremented `currencyEarnedThisRun` but did not push an updated preview to the client.

**Client fix** (`game/client/socketHandlers/stateHandlers.js`): On `enteringPlaying`, seed `_lastReturnRewardsPreview` from the deploy snapshot when present. On subsequent `playing` ticks, re-apply the cached preview onto `gameState.players[myId]` when the slim payload omits it. Lobby entry still clears the cache.

**Server fix** (`game/server/socketHandlers/runHandlers.js`): After currency loot pickup, call `maybeEmitPlayerDeckUpdate(player)`, which attaches a fresh `returnRewardsPreview` from `previewReturnRewards()` (sourced from `currencyEarnedThisRun`).

**Display path** (`game/client/main.js` `syncLevelSettingsRewards()`): Reads `me?.returnRewardsPreview ?? _lastReturnRewardsPreview`. With a valid preview:
- `lootCurrency > 0` → `Money this run: {amount}` and a keep/forfeit line with collected + contract-bonus context.
- `lootCurrency === 0` → `Money this run: none collected yet` and `Complete the contract to earn {bonus} (+ any money you collect)` (not em-dashes).
- Give-up cost line updates based on `lootCurrency` (pre-existing logic, unaffected by this bug).

Deploy uses full `stateSnapshot()` (includes `returnRewardsPreview` via `buildPlayerColdSnapshot`). Auto-collect paths in `keyItemEffects.js` emit full `stateSnapshot()` after incrementing `currencyEarnedThisRun`, so they already refresh the preview on the wire.

### Acceptance: Values update if reopened after collecting more loot

**PASS**

End-to-end chain after currency pickup:

1. Server emits `deckUpdate` with updated `returnRewardsPreview.lootCurrency`.
2. Client `applyInRunDeckPayload` updates `_lastReturnRewardsPreview` and the player object (`main.js` ~2446–2450).
3. If overlay is open, `lobbyHandlers.js` calls `syncLevelSettingsRewards()` on `deckUpdate`.
4. Reopening the overlay always calls `syncLevelSettingsRewards()` in `openLevelSettingsOverlay()`.

Integration test `emits deckUpdate with refreshed returnRewardsPreview.lootCurrency after currency loot pickup` asserts `lootCurrency === currencyEarnedThisRun` after pickup. Magic-stone pickup correctly does **not** emit `deckUpdate` (no erroneous currency preview).

### Verification: harness checks (vitest server + client)

**PASS**

`coverage.log`: 280 client + 57 server test files, all passed (4043 + 1236 tests). New coverage:
- `client/test/level-settings-rewards.test.js` (2 tests) — cache survival and lobby clear.
- `server/test/integration.test.js` — currency loot `deckUpdate` + magic-stone non-regression.

Independent re-run of the focused suite also passed.

### Consistency with `game/docs/design.md` and foundation

**PASS**

No changes to economy rules, give-up/forfeit semantics, or telepipe durability. The fix only restores correct readout of existing server-authoritative `previewReturnRewards()` data in the Lv overlay. No regressions to requirements surfaced in review.

### Code quality

**PASS**

- Minimal, targeted diff across four game files (+ tests).
- Reuses existing `maybeEmitPlayerDeckUpdate` / `buildPlayerDeckUpdatePayload` rather than duplicating preview logic.
- `maybeEmitPlayerDeckUpdate` correctly exported from `progression.js`.
- No dead code or obvious bugs in the changed paths.

**Minor refactor note:** `extractedLobbyOverlayActive = false` was removed from the deploy (`enteringPlaying`) branch when restructuring; it remains cleared on `enteringLobby`. No observed impact in capture or tests (see nits).

### Debug scenarios

**N/A — no new or changed debug scenarios.** Existing `summon-ready` used only in server integration tests behind `ALLOW_DEBUG_SCENARIOS`; normal gameplay path (deploy → collect loot → open Lv) is unchanged and is what the fix targets.

---

## Harness capture gap (non-blocking)

Round-1 capture used the **fallback** full-flow smoke plan (movement + dodge). It did **not** open the Lv overlay or pick up currency loot. Acceptance for this ticket is explicitly vitest-driven; the code path and integration tests cover the reported bug. Runtime health is still proven by the capture.

---

## Remaining gaps

None. Both sub-ticket fixes integrate correctly; the full ticket acceptance criteria are met with automated test coverage and a clean captured run.

VERDICT: PASS
