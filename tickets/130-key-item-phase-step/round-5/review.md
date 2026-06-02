# Review: Key Item — Phase Step (ticket 130)

Holistic review of the full ticket (four implementation commits on branch `auto/130-key-item-phase-step`) against `ticket.md`, `game/docs/design.md`, and `game/docs/requirements.md`. Code was read in the working tree; change scope was verified with `git log` / `git diff` from baseline `fe4077430fca21aa72d3c5a1d95f4142f96aa85e`.

## Runtime health (gate)

**FAIL — no clean captured browser run.**

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | **`false`** |
| `failure_kind` | `capture_failed` (not `browser_pageerror`) |
| `pageerrors` | Absent / empty — no uncaught JS defect attributed to game code |
| `console.log` | **Missing** — no Playwright browser console capture |
| Dev servers | Appear to have started (`client.log`, `server.log`, `capture_diagnosis` port holders on :5173 and :3000) |

`round-5/screenshot.log` ends before any browser session:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from .../harness/screenshot.mjs
```

This is harness capture infrastructure (missing Playwright install), not a game-module load failure. Per review rules, **`metrics.json` with `"ok": false` still blocks PASS** — we have no proof the client loaded and ran cleanly in the browser.

## Harness blockers

Capture failed because the screenshot harness cannot resolve `playwright`:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from
/home/matt/workspace/.autogame-worktrees/130-key-item-phase-step/harness/screenshot.mjs
```

`metrics.json` also reports `failure_kind: "capture_failed"` with empty `capture_diagnosis.detected`. Vite and the game server log tails show both processes listening; this is not a game-code startup crash.

**Code-only assessment:** If capture had completed, nothing in the reviewed server/client diff suggests a load-time failure. Unit/integration tests for `phase_step` pass (see Tests criterion). Re-run round-5 capture after restoring Playwright for the harness; only chase `game/` if the rerun reports `pageerrors` or gameplay defects.

---

## Per-criterion findings

### Cooldown ~12s

**Met (code + tests).** `KEY_ITEM_DEFS.phase_step` in `game/server/progression.js` sets `cooldownMs: 12000`. The success path sets `player.keyItemCooldownUntil = now + (def.cooldownMs || 12000)`. `phase_step.test.js` asserts the def and that a second immediate use returns `on_cooldown` with `remainingMs > 0`.

### Requires co-op ally in same run; solo → fail gracefully

**Met (code + tests).** Candidates are other players in `state.players` who are living and not `extracted` — i.e. co-op partners in the active run. Solo use emits `{ ok: false, reason: 'no_ally' }` and returns before touching cooldown. Covered in `phase_step.test.js`.

### No swap through walls (both endpoints valid)

**Met at the level specified by implementation.** Before swapping, the server requires `isInsideDungeon(player.x, player.z)` and `isInsideDungeon(ally.x, ally.z)`; failure emits `invalid_position` without burning cooldown. That matches the subticket spec (walkable AABB endpoints, same helper used alongside `summon_recall`). Normal movement uses wall colliders, so live players should not occupy wall-blocked cells; there is no dedicated test for wall-overlap endpoints (see nits).

The swap exchanges `x`, `y`, and `z` verbatim (including floor height), which is correct for a position trade.

### Client target highlight or auto-nearest

**Met (code).** `game/client/renderer.js` recomputes the nearest in-range ally each frame when the local player has `phase_step` equipped (`syncPhaseStepAllyHighlight`), draws a cyan ground ring, and exposes `getPhaseStepTargetId()`. `game/client/main.js` passes `targetPlayerId` on `useKeyItem`. The server still auto-picks nearest ally when `targetPlayerId` is omitted or invalid, so client highlight is UX, not authority.

Range constant `PHASE_STEP_RANGE = 6` on the client mirrors `def.range` on the server.

### Tests: two players swap coords; out of range fails

**Met.** `game/server/test/phase_step.test.js` (6 cases): def semantics, nearest-ally swap, explicit `targetPlayerId`, out-of-range without cooldown burn, solo `no_ally`, cooldown enforcement. `round-5/coverage.log` reports **33 test files / 933 tests passed**, including all `phase_step` cases.

Independent run of the server suite in this worktree also completed with all tests passing (including `phase_step` integration cases).

### Design and foundation consistency

**Met.** Phase Step fits the existing server-authoritative key-item pattern: whitelist in `useKeyItem`, soft-fail without cooldown burn, `keyItemUsed` + `stateUpdate` on success. No regression against `game/docs/requirements.md` (3D render, socket multiplayer, movement sync). Unrelated but bundled commit `8c4a659` tightens `summon_recall` spiral fallback min-distance — does not weaken Phase Step.

### Debug scenario (`phase-step-ready`)

**Met.**

- **Gated:** Only via `?debugScenario=phase-step-ready` on localhost (`main.js`) → `debugScenario` socket handler; production hostnames do not apply scenarios.
- **No shortcut for swap:** Scenario equips `phase_step`, clears enemies, clears cooldown — it does **not** inject a synthetic ally (removed in commit `7de4586`). A real second player is still required to exercise swap, matching `phase_step.test.js`.
- **Normal path preserved:** Key items are equippable in lobby; co-op ready-up reaches the same playing state. Swap logic is unchanged whether or not the debug URL was used.

### Code quality

**No blocking issues found.** Implementation is focused, mirrors patterns from other key items, and avoids dead paths. No browser `pageerrors` were captured to investigate. Client/server range duplication is maintainable (documented in code comment).

---

## Remaining gaps

1. **No successful round-5 browser capture** — `metrics.json` has `"ok": false`, `console.log` is absent, and `screenshot.log` shows missing `playwright`. Runtime proof is mandatory for PASS; fix harness deps and re-capture before merging this ticket.

No blocking gaps were found in `game/` implementation against the acceptance criteria given current test evidence.

VERDICT: FAIL
