# Senior review: 146-cleanup-key-item-data-and-persistence

**Baseline:** `fd95d4f50d42c9eb1bffd80f6e25a8f2319effc2`  
**Commits:** `cfd0f81` (dead/extracted), `7d0c3a3` (listKeyItems), `6d75544` (debug-scenario test)  
**Scope:** `game/server/index.js`, `game/server/test/key-items.test.js`, `game/server/test/debug-scenarios.test.js` (+ subticket ticket.md files)

## Runtime health (capture gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` `pageerror` / `[fatal]` | None |
| Gameplay probes | `phase: "playing"`, canvas + hand visible; dodge cooldown HUD after dodge (413ms → 62ms remaining) |

The fallback smoke capture reached lobby → ready → movement → dodge with post-dodge cooldown UI, matching the ticket’s key-item surface area.

Benign noise only: Vite connect lines, HTTP **409** on an early resource (both players; game still initialized scenes). No harness infra failure.

`pageerrors.json` is `[]`. Round-1 `coverage.log` hit the vitest 120s global timeout on the full changed-files run; targeted runs of the new tests pass (see Verification).

---

## useKeyItem silent failure when dead or extracted

**Acceptance**

| Criterion | Finding |
|-----------|---------|
| Dead player in `playing` gets `{ ok: false, reason: 'dead' }` | Met. Handler splits `player.dead` / `player.extracted` after `gamePhase === 'playing'` guard; emits `keyItemUsed` and returns before cooldown or effect logic. |
| Extracted player gets `{ ok: false, reason: 'extracted' }` | Met. Same pattern with `reason: 'extracted'`. |
| Unit/socket test for dead | Met. `useKeyItem is rejected when player is dead with dead reason` uses `connectAndStartRun()`, sets `player.dead = true`, asserts payload and no cooldown change. |
| Unit/socket test for extracted | Met. Parallel test with `player.extracted = true`. |

**Code quality:** Aligns with existing structured rejection reasons (`on_cooldown`, `not_in_dungeon`, etc.). Missing player still returns silently (`if (!player) return;`) — unchanged and acceptable per subticket spec.

---

## Client-facing list key items socket (optional pre-119)

**Acceptance**

| Criterion | Finding |
|-----------|---------|
| `listKeyItems` on authenticated connections | Met. Registered in the post-auth socket setup block beside `listLobbies` (~1557). |
| Response `keyItemsListed` with `{ items }` | Met. Maps `id`, `name`, `description`, `cooldownMs` from `getUnlockedKeyItems()`. |
| All 14 items, no grind flags | Met. `getUnlockedKeyItems()` returns all `KEY_ITEM_DEFS` values; test asserts length 14 and known ids. |
| Read-only / no state mutation | Met. Test snapshots `equippedKeyItemId` and `keyItemCooldownUntil` before/after; handler has no writes. |
| Socket test | Met. `describe('listKeyItems socket handler')` in `key-items.test.js`. |

**Design / 119 prep:** Omits internal fields (`type`, `invincibleDurationMs`, etc.) as intended for lobby UI. No client listener yet — not required by this ticket (server contract only).

---

## key-item-cooldown debug scenario test

**Acceptance**

| Criterion | Finding |
|-----------|---------|
| Test with `ALLOW_DEBUG_SCENARIOS=1` | Met. `debug-scenarios.test.js` sets env in `beforeEach`, restores in `afterEach`. |
| `gamePhase === 'playing'` after success | Met. `applyDebugScenario` calls `enterPlayingPhase(lobby)` before the `key-item-cooldown` branch; test asserts `testGameState().gamePhase`. |
| `keyItemCooldownUntil > Date.now()`, `equippedKeyItemId === 'dodge_roll'` | Met. Branch at ~961–966 sets both; test asserts via `playerForSocket`. |
| Tests pass | Met. `vitest run server/test/debug-scenarios.test.js` passes in review. |

**Debug scenario policy (pre-existing scenario, new test only):**

- **Gating:** Server `isDebugScenarioAllowed` (env flag or local connection); client only auto-emits from `?debugScenario=` on localhost/`127.0.0.1`/`::1` (`main.js`). Normal players never hit it.
- **Normal path:** Cooldown after using dodge_roll in a run is the real equivalent; scenario only seeds state for QA.
- **Invariants:** Does not bypass `useKeyItem` validation — it pre-sets cooldown to exercise `on_cooldown` rejection, which normal dodge use also produces.

---

## Consistency with design docs and requirements

- **`game/docs/design.md`:** No key-item persistence changes; cleanup is socket/protocol polish consistent with lobby + dungeon architecture.
- **`game/docs/requirements.md`:** No key-item regressions identified; changes are additive handlers and error responses.
- **`CONTEXT.md`:** Read at repo root (not under ticket folder).

---

## Integration and code quality

- **Focused diff:** Three logical commits, no unrelated `game/` churn.
- **Patterns:** Matches neighboring socket handlers (`listLobbies`, `useKeyItem` ack events).
- **Regression risk:** Low — dead/extracted paths are early returns; `listKeyItems` is read-only.
- **Capture evidence:** Dodge roll + cooldown HUD in probes/screenshots exercises the live key-item path unrelated to the new APIs.

---

## Verification (reviewer)

```bash
cd game && pnpm exec vitest run server/test/debug-scenarios.test.js
cd game && pnpm exec vitest run server/test/key-items.test.js -t "dead|extracted|listKeyItems"
```

Both succeeded during review.

---

## Remaining gaps

None blocking. Runtime capture is clean; all top-level acceptance criteria are implemented and covered by targeted tests.

---

VERDICT: PASS
