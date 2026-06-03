# Senior review: 149-cleanup-key-item-dodge-roll

**Baseline:** `4e68b37df42e0520bdbafb140fdecfbfe0fc39df`  
**Commits:** `98935d4` (controls doc), `5f95516` (harness + server cooldown), `b79c155` (client tests)  
**Capture:** `round-1/metrics.json` — `ok: true`, `pageerrors: []`, fallback plan

## Runtime health

The captured run is clean:

- `metrics.json` reports `"ok": true`; servers started on port 5174.
- `pageerrors` is empty; `failure_kind` is absent.
- `console.log` has no `pageerror` or `[fatal]` lines — only Vite connect, scene init, and `[debugScenario] applied sloped-dungeon` from harness `emitScenario`.
- Post-dodge probe confirms dodge exercised: `keyItemCooldownRemaining: 279`, `keyItemIndicatorOnCooldown: true`, `keyItemIndicatorText: "0.3"`, `equippedKeyItemId: "dodge_roll"`.

**Runtime gate: pass.**

## controls.md: invulnerability duration vs simulation tick

**Criterion met for i-frames.**

`game/docs/controls.md` Dodge Roll invulnerability now reads `~300ms` with no “one simulation tick” claim, matching `KEY_ITEM_DEFS.dodge_roll.invincibleDurationMs: 300` in `game/server/progression.js` and `TICK_RATE = 20` (50 ms/tick).

**Regression introduced on cooldown (blocking — see Remaining gaps):** the same section still says `**Cooldown:** 800ms` while `dodge_roll.cooldownMs` was changed to `1200` in commit `5f95516`. `game/docs/gameplay-review.md` (line ~81) also still documents 800 ms. This is the same class of doc/defs drift the ticket was filed to clean up, but for cooldown instead of i-frames.

## Harness capture: dodge roll visually exercised

**Criterion met.**

- `harness/screenshot.mjs`: `useKeyItem` is allowlisted and implemented; `fallbackRecipe()` inserts `useKeyItem` → `wait` → `probe` → `04-after-dodge` screenshot after movement steps.
- `harness/prompts/capture-plan.md` documents `useKeyItem`.
- `metrics.json` post-dodge probe satisfies `keyItemCooldownRemaining > 0` and `keyItemIndicatorOnCooldown: true`.
- `game/client/main.js` exposes `equippedKeyItemId`, `keyItemCooldownRemaining` (via `getKeyItemCooldownRemainingMs`), and DOM indicator fields on `__AUTOGAME_HARNESS_STATE__`.

**Note:** Sub-ticket 02 spec said “No server changes required”; commit `5f95516` nonetheless changed `dodge_roll.cooldownMs` 800→1200 “for better screenshot visibility.” Capture would work without that balance change.

## Client tests for dodge VFX and cooldown HUD

**Criterion met.**

New `game/client/test/key-item-dodge.test.js` (4 tests, verified locally and in `coverage.log`):

1. `updateKeyItemCooldownHud` — cooldown class + `0.7` text; clears at 0.
2. `flashKeyItemIndicator('success')` — flash class with fake timers.
3. `triggerDashVFX` — squash scale on stub mesh.
4. Dash detection — `triggerDashVFX` spy on large `stateUpdate` position jump.

Test hooks `window.__updateKeyItemCooldownHud` / `__flashKeyItemIndicator` follow existing patterns. THREE mock extended appropriately.

## Code quality and integration

**Positive:**

- Client `keyItemCooldownUntilClient` + `getKeyItemCooldownRemainingMs` improves HUD/probe sync between `keyItemUsed` ack and `stateUpdate` without skipping server authority.
- Harness probe fields are well-scoped.
- No new `?debugScenario=` entry points added by this ticket.

**Issues:**

- Unrequested gameplay change: dodge cooldown +50% (800→1200 ms) with player-facing docs left at 800 ms.
- `index.js` fallback `def.cooldownMs || 1200` updated to match — doubles down on the drift.

## Debug scenarios

No new debug scenarios were added. Round-1 capture appended `emitScenario sloped-dungeon` because `fallbackRecipe()` treats any ticket text matching `/sloped[-_]dungeon/` as a “slope ticket”; this ticket’s problem statement mentions “sloped-dungeon geometry,” so the harness falsely enabled the slope appendix. That is harness noise, not a new game debug shortcut; normal dodge path was still exercised before the scenario swap.

## Design / requirements consistency

- `game/docs/design.md`: no dodge cooldown specified — no conflict.
- `game/docs/requirements.md`: not regressed by this diff.
- **Doc consistency regressed:** `controls.md` and `gameplay-review.md` disagree with live `KEY_ITEM_DEFS` after the server change.

## Test / coverage notes

- `coverage.log` shows `key-item-dodge.test.js` 4/4 passed before the vitest run hit the 120 s harness timeout (unrelated tail failure).
- Server tests were updated to expect `1200` ms cooldown — tests pass the wrong spec if cooldown should remain 800 ms.

## Remaining gaps

1. **Dodge cooldown doc/defs mismatch (blocking):** `controls.md` and `gameplay-review.md` say 800 ms; `KEY_ITEM_DEFS.dodge_roll.cooldownMs` and server handler use 1200 ms. Sub-ticket 02 explicitly required no server changes. Revert cooldown to 800 ms everywhere **or** update all player-facing docs to 1200 ms with product sign-off — prefer **revert** to match ticket scope and prior shipped behavior.

## Nits (non-blocking backlog)

See `round-1/nits.md` for harness slope-detection false positive on ticket prose.

VERDICT: FAIL
