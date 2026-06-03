# Senior review: 149-cleanup-key-item-dodge-roll (round 3)

**Baseline:** `4e68b37` (151-cleanup-key-item-field-medic-kit complete)  
**Commits:** `98935d4` … `24fdc6c` (5 subticket commits)  
**Scope:** Documentation nit, harness dodge capture, client unit tests, temporary 1200 ms cooldown revert, post-dodge probe timing.

## Runtime health (capture proof)

Round-3 capture is healthy and is sufficient proof the game loads and plays:

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` | Empty `[]`; `pageerrors.json` is `[]` |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines — Vite connect, scene init, and `[debugScenario] applied sloped-dungeon` only |

**Post-dodge probe (acceptance for harness):** Probe *"After dodge roll — cooldown HUD should be active."* reports `keyItemCooldownRemaining: 396`, `keyItemIndicatorOnCooldown: true`, `keyItemIndicatorText: "0.4"`, `equippedKeyItemId: "dodge_roll"`. Player moved (`x/z` changed) and took combat damage during the roll (`hp` 100 → 94), consistent with a real dodge through normal `useKeyItem` → server simulation.

Screenshot `04-after-dodge.png` is present in the capture set alongside movement and lobby shots.

---

## Acceptance criteria

### 1. `controls.md`: invulnerability duration vs simulation tick

**Met.** Dodge Roll section now reads:

- **Cooldown:** 800 ms (matches `KEY_ITEM_DEFS.dodge_roll.cooldownMs` and `game/docs/gameplay-review.md`)
- **Invulnerability:** ~300 ms (matches `invincibleDurationMs: 300` in `game/server/progression.js`)

The incorrect “one simulation tick” wording is gone; there is no contradiction with `TICK_RATE` (20 Hz → 50 ms/tick).

### 2. Harness capture: dodge roll visually exercised

**Met.** `harness/screenshot.mjs` `fallbackRecipe()` inserts `useKeyItem` for player A, a post-dodge `probe`, and `04-after-dodge` screenshot after movement steps. `harness/prompts/capture-plan.md` documents `useKeyItem` in the allowlist.

Timing fix (subticket 05): the extra 500 ms `wait` after dodge was removed; `useKeyItem`’s built-in ~400 ms settle leaves the probe inside the 800 ms cooldown window.

`game/client/main.js` extends `__AUTOGAME_HARNESS_STATE__()` with `keyItemCooldownRemaining`, `keyItemIndicatorOnCooldown`, and `keyItemIndicatorText` so probes can assert cooldown without DOM-only guessing.

### 3. Client tests for dodge VFX and cooldown HUD

**Met.** New `game/client/test/key-item-dodge.test.js` (4 tests, all pass per `coverage.log`):

- `updateKeyItemCooldownHud` toggles `#key-item-indicator.cooldown` and countdown text; clears at 0
- `flashKeyItemIndicator('success')` adds/removes `flash-success` with fake timers
- `triggerDashVFX` applies squash scale when a player mesh exists
- `stateUpdate` path calls `triggerDashVFX` when position delta exceeds dash threshold

Test hooks `window.__updateKeyItemCooldownHud` / `__flashKeyItemIndicator` follow existing patterns. THREE mock updates support `position.copy` / `scale.set` used by renderer tests.

---

## Sub-ticket integration (holistic)

| Subticket | Outcome |
|-----------|---------|
| 01 — doc i-frames | `game/docs/controls.md` aligned |
| 02 — harness dodge capture | Recipe + allowlist + harness state fields |
| 03 — client tests | `key-item-dodge.test.js` |
| 04 — revert 800 ms cooldown | `progression.js`, `index.js`, server tests at 800 ms; net server diff vs baseline is zero (1200 ms bump in 02 was fully reverted) |
| 05 — probe timing | Post-dodge probe sees active cooldown |

**Client HUD sync (integration):** `keyItemCooldownUntilClient` plus `getKeyItemCooldownRemainingMs()` update the HUD immediately on `keyItemUsed` and on each `stateUpdate`, fixing the race where probes ran after cooldown visually cleared but before the next authoritative tick. This is appropriate for 800 ms cooldown and does not bypass server validation.

---

## Design and requirements

- Consistent with `game/docs/design.md` (no loop/combat regressions; cleanup-only).
- Dodge behavior unchanged vs baseline server defs (800 ms cooldown, 300 ms i-frames).
- No edits to persistence, net replication, or debug-scenario registration beyond harness/client QA helpers.

---

## Code quality

- No dead code or obvious logic bugs in the touched paths.
- Server dodge handler still uses `def.cooldownMs || 800` and `invincibleDurationMs || 300`.
- Round-3 targeted coverage run: 159 client tests passed (3 files including new dodge tests).

---

## Debug scenarios

This ticket did **not** add a new `?debugScenario=` shortcut.

Round-3 capture appended `emitScenario sloped-dungeon` because `fallbackRecipe()` treats ticket markdown matching `/sloped[-_]dungeon/` as a slope ticket; ticket 149’s harness-capture **problem statement** mentions “sloped-dungeon geometry.” That runs **after** dodge steps and does not replace the normal dodge path exercised earlier in the recipe. Pre-existing `sloped-dungeon` remains localhost-gated via `debugScenarioAllowed` and socket `debugScenario` — not a blocking issue for this ticket (see nits).

---

## Remaining gaps

None blocking. Runtime proof, all three top-level acceptance criteria, and subticket integration are satisfied.

---

VERDICT: PASS
