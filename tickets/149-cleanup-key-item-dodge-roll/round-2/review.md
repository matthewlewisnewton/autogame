# Senior review: 149-cleanup-key-item-dodge-roll (round 2)

**Baseline:** `4e68b37df42e0520bdbafb140fdecfbfe0fc39df`  
**Commits:** `98935d4` (controls doc), `5f95516` (harness dodge capture + client cooldown sync), `b79c155` (client tests), `7f1be88` (revert dodge cooldown to 800 ms)  
**Capture:** `round-2/metrics.json` — `ok: true`, `pageerrors: []`, fallback plan

## Runtime health

The captured run starts and loads cleanly:

- `metrics.json` reports `"ok": true`; game served at `http://localhost:5174/`.
- `pageerrors` is empty; no `failure_kind` / `harness_failure`.
- `console.log` has no `pageerror` or `[fatal]` lines — only Vite connect, scene init, benign 409 registration conflicts, and `[debugScenario] applied sloped-dungeon` from harness `emitScenario`.
- `pageerrors.json` is `[]`.

**Runtime gate: pass.**

## controls.md: invulnerability duration vs simulation tick

**Criterion met.**

`game/docs/controls.md` Dodge Roll section now reads:

- **Cooldown:** 800 ms — matches `KEY_ITEM_DEFS.dodge_roll.cooldownMs` in `game/server/progression.js` and the handler fallback in `game/server/index.js`.
- **Invulnerability:** ~300 ms (no “one simulation tick” wording) — matches `invincibleDurationMs: 300` and `TICK_RATE = 20` (50 ms/tick; six ticks ≈ 300 ms).

`game/docs/gameplay-review.md` (§ Key item) also documents 800 ms cooldown and ~300 ms i-frames, aligned with live defs after commit `7f1be88`.

## Harness capture: dodge roll visually exercised

**Criterion not met (blocking).**

**What was implemented:**

- `harness/screenshot.mjs` allowlists and implements `useKeyItem`; `fallbackRecipe()` inserts `useKeyItem` → `wait` (500 ms) → post-dodge `probe` → `04-after-dodge` screenshot after movement steps.
- `harness/prompts/capture-plan.md` documents the `useKeyItem` action.
- `game/client/main.js` exposes `equippedKeyItemId`, `keyItemCooldownRemaining` (via `getKeyItemCooldownRemainingMs`), and DOM indicator fields on `__AUTOGAME_HARNESS_STATE__` / `collectProbe`.

**What the capture proves:**

- Dodge input was sent during `playing` (recipe step present; player moved and took damage between probes).
- **Post-dodge probe does not satisfy the acceptance assertion:** `keyItemCooldownRemaining: 0`, `keyItemIndicatorOnCooldown: false`, `keyItemIndicatorText: ""` (see `metrics.json` probe “After dodge roll — cooldown HUD should be active.”).

**Root cause:** Commit `7f1be88` correctly reverted server cooldown to **800 ms** (per subticket 04 and `controls.md`), but the fallback recipe still waits **400 ms** (`useKeyItem` default) + **500 ms** (`wait`) ≈ **900 ms** before probing — longer than the cooldown window, so the HUD and harness fields read zero even when dodge succeeded. Round-1 capture passed this probe only while cooldown was temporarily **1200 ms** (`keyItemCooldownRemaining: 279`).

The ticket requires a probe or screenshot asserting `keyItemCooldownRemaining > 0` **or** `#key-item-indicator.cooldown`. Round-2 evidence satisfies neither.

## Client tests for dodge VFX and cooldown HUD

**Criterion met.**

`game/client/test/key-item-dodge.test.js` (4 tests, all passed in `coverage.log`):

1. `updateKeyItemCooldownHud` — toggles `.cooldown` class and countdown text (`0.7`).
2. `flashKeyItemIndicator('success')` — flash class with fake timers.
3. `triggerDashVFX` — squash scale on stub player mesh.
4. Dash detection in `stateUpdate` — `triggerDashVFX` spy when position delta exceeds threshold.

Test hooks `window.__updateKeyItemCooldownHud` / `window.__flashKeyItemIndicator` follow existing patterns; THREE mock extended appropriately.

## Code quality and integration

**Positive:**

- Client `keyItemCooldownUntilClient` + `getKeyItemCooldownRemainingMs` correctly bridges `keyItemUsed` ack and `stateUpdate` without bypassing server authority.
- Server defs, handler fallback, and server tests are consistent at 800 ms after `7f1be88`.
- No new `?debugScenario=` shortcuts added by this ticket.
- Diff scope matches cleanup intent (docs, harness, client tests, cooldown revert).

**Integration gap:**

- Subticket 04 reverted cooldown to 800 ms with “do not change harness,” but the top-level ticket still requires capture proof of an **active** cooldown HUD. Harness timing was not re-tuned after the revert, so round-2 capture fails an acceptance criterion that round-1 only passed via the temporary 1200 ms balance change.

## Debug scenarios

No new development debug scenarios were added by this ticket.

Round-2 capture appended `emitScenario sloped-dungeon` because `fallbackRecipe()` treats ticket markdown matching `/sloped[-_]dungeon/` as a slope ticket; ticket 149’s problem statement mentions “sloped-dungeon geometry,” so the harness adds an unrelated ramp screenshot. Dodge steps run **before** that scenario swap; this is harness noise, not a regression in normal dodge flow. See `nits.md`.

## Design / requirements consistency

- `game/docs/design.md`: no dodge-specific cooldown — no conflict.
- `game/docs/requirements.md`: foundation not regressed by this diff.

## Test / coverage notes

- `coverage.log`: client tests 159/159 passed including `key-item-dodge.test.js` (visibility-only coverage on changed client files).
- Server dodge/key-item tests updated for 800 ms in `7f1be88` (not re-run in round-2 `coverage.log`, but expectations match live defs).

## Remaining gaps

1. **Harness capture does not assert active dodge cooldown (blocking):** After `useKeyItem`, the post-dodge probe reports `keyItemCooldownRemaining: 0` and `keyItemIndicatorOnCooldown: false` because fallback waits ~900 ms while server cooldown is 800 ms. The top-level acceptance criterion requires `keyItemCooldownRemaining > 0` or `#key-item-indicator.cooldown` in capture evidence.

## Nits (non-blocking backlog)

See `round-2/nits.md`.

VERDICT: FAIL
