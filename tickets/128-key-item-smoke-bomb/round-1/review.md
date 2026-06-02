# Senior Review: Key Item — Smoke Bomb (128-key-item-smoke-bomb)

**Baseline:** `d564f545d08aad78fe9fcf5ee11597054a799956`  
**Commits:** 4 (`01-server-smoke-veil-cast` → `04-tests-and-docs-smoke-veil`)  
**Reviewer scope:** Holistic ticket (runtime capture + live `game/` tree + diff)

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok: true`, servers started | Yes (`http://localhost:5174/`) |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `console.log` `pageerror` / `[fatal]` from game code | None |

`console.log` shows only Vite connect logs, benign `409 (Conflict)` on an auth/resource request (not tagged `pageerror`), and `[initScene]` — acceptable per harness noise rules.

**Conclusion:** The captured run proves the game starts and loads cleanly.

---

## Acceptance criteria

### Cooldown ~8s

**Met.** `KEY_ITEM_DEFS.smoke_bomb.cooldownMs` is `8000`. `useKeyItem` sets `keyItemCooldownUntil = now + cooldownMs`. Socket tests assert cooldown enforcement and that a re-cast during cooldown returns `on_cooldown` without refreshing the veil (`smoke_bomb.test.js`, `key-items.test.js`).

### Zone follows player or stays fixed at cast point (documented)

**Met — fixed cast point.** Server snapshots `smokeVeilX` / `smokeVeilZ` at cast time; `isPlayerInSmokeVeil()` tests horizontal distance from that center, not live player position. Documented in:

- `progression.js` definition description
- `game/docs/controls.md` (Smoke Veil section)
- Inline comments in `index.js`, `simulation.js`, `renderer.js`

### Client smoke VFX

**Met in code.** `triggerSmokeVFX()` in `renderer.js` renders a grey transparent disc at the cast point with expand/fade timing (~2s). Triggered on local `keyItemUsed` (`main.js`) and from replicated `stateUpdate` fields (`smokeVeilUntil`, `smokeVeilX/Z`, `smokeVeilRadius`) in `updateSceneFromState`. Fields are included in `stateSnapshot` (`progression.js`).

Round-1 capture used the generic fallback movement plan and did not cast Smoke Veil in-browser; VFX is not visually proven in screenshots but is wired consistently with other key-item VFX patterns.

### Tests: enemy ranged miss rate up **or** targeting cleared in zone

**Met — targeting suppression (documented choice).** Ticket allows picking one rule; implementation uses **targeting cleared**, not random miss chance, documented in `controls.md`.

`isPlayerInSmokeVeil()` gates enemy AI in `updateEnemies()`:

- Nearest-target selection skips veiled players (`continue` in player loop).
- Windup resolution cancels strike with no damage when target is inside the disc.
- Leaving the disc or expiring `smokeVeilUntil` restores normal damage.

`smoke_bomb.test.js` (12 tests) plus `key-items.test.js` smoke cases cover cast state, cooldown, windup prevention, windup cancel, post-veil damage, expiry, and multi-player target preference.

---

## Design & foundation consistency

- Aligns with card/combat multiplayer model in `game/docs/design.md` — server-authoritative combat, client visuals only.
- No changes to core loop docs in `requirements.md`; smoke bomb is additive key-item behavior on existing `useKeyItem` / enemy AI paths.
- Depends on key-item data/persistence (118): definition in `KEY_ITEM_DEFS`, snapshot replication, cooldown field — consistent with sibling key items.

---

## Debug scenarios

Added `smoke-bomb-ready` and `smoke-veil-ready` in `DEBUG_SCENARIOS`.

| Requirement | Assessment |
|-------------|------------|
| Gated to debug/dev path only | **Pass.** Client: `?debugScenario=` on localhost only (`debugScenarioAllowed`). Server: `debugScenario` socket handler behind `isDebugScenarioAllowed()` (local address/origin/host or `ALLOW_DEBUG_SCENARIOS=1`). |
| Same end-state reachable in normal play | **Pass.** Normal path: `useKeyItem({ keyItemId: 'smoke_bomb' })` after equipping via `equipKeyItem`. Scenarios only pre-equip / pre-veil for QA. |
| Does not bypass server validation for real casts | **Pass.** `smoke-veil-ready` sets server state directly for VFX/targeting QA (same pattern as `guard-block-ready`, etc.); it does not replace the `useKeyItem` code path tested in unit/socket tests. |

---

## Code quality & integration

**Strengths**

- Clear separation: cast/state in `index.js`, AI in `simulation.js`, VFX in `renderer.js`, definition in `progression.js`.
- Exported `isPlayerInSmokeVeil` for focused unit tests.
- Cooldown and cast-position edge cases covered.

**Notes (non-blocking)**

- `coverage.log` from the harness run reports one unrelated flaky failure in `integration.test.js` (reward persistence / weapon slot); that file was not touched by this ticket. Targeted vitest run after review: **1452 passed** including all `smoke_bomb.test.js` and smoke-related `key-items.test.js` cases.
- No dedicated client unit tests for `triggerSmokeVFX` (acceptable given ticket `Verification: code` and server-heavy behavior).

---

## Commits & files changed

```
33ba248 01-server-smoke-veil-cast
2b836e7 02-server-smoke-enemy-targeting
50bc85f 03-client-smoke-vfx
1c40881 04-tests-and-docs-smoke-veil
```

Primary touchpoints: `progression.js`, `index.js`, `simulation.js`, `renderer.js`, `main.js`, `controls.md`, `smoke_bomb.test.js`, `key-items.test.js`, `server.test.js` snapshot fields.

---

## Remaining gaps

None blocking. All acceptance criteria are implemented, tested, and documented; runtime capture is clean.

---

## Nits (see `nits.md`)

Optional follow-ups: agent-guided capture for smoke VFX; client-level smoke VFX test.

VERDICT: PASS
