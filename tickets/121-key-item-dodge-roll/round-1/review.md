# Senior Review — Ticket 121: Key Item Dodge Roll

**Baseline:** `7ed21a4a5e4785cac2b5242ba5a9b8f61bd6a179`  
**Commits:** 5 (`01-client-useKeyItem-payload` … `05-tests-dodge-roll-and-docs`)  
**Capture:** `round-1/metrics.json`, `console.log`, 4 screenshots, `sloped-dungeon` scenario

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` | Pass (Vite connect + scene init only) |

Game starts and loads cleanly. No harness infra failure.

## Per-criterion findings

### Cooldown gate (no dash while on cooldown)

**Met.** `useKeyItem` in `game/server/index.js` checks `keyItemCooldownUntil` before movement and emits `{ ok: false, reason: 'on_cooldown', remainingMs }`. Client flashes `#key-item-indicator` with `flash-cooldown` on that reason (`main.js`). Covered by `key-items.test.js`, `dodge_roll.test.js` (simulated gate), and integration test `useKeyItem dodge_roll moves player and sets cooldown; second emit within cooldown returns on_cooldown`.

### Successful dash — speed, direction, cooldown

**Met.**

- **Direction:** Normalized `inputDx` / `inputDz`; if magnitude ≈ 0, falls back to `sin/cos(rotation)` (`index.js` ~2443–2454).
- **Distance:** `MOVE_SPEED * 3 * (rollDistanceMs / 1000)` → 12 × 3 × 0.2 = **7.2 units** instantaneous displacement (~3× distance walked in 200 ms at normal speed). Matches “~2–3× normal move speed over a short distance.”
- **Cooldown:** `KEY_ITEM_DEFS.dodge_roll.cooldownMs = 800`; `keyItemCooldownUntil = now + cooldownMs`; snapshot exposes `keyItemCooldownRemaining`.

### Invulnerability (one simulation tick)

**Mostly met — spec wording drift.**

- **Mechanism:** `invulnerableUntil` checked once at top of `damagePlayer()` in `simulation.js` (~1403–1404). Not persisted; reset on respawn. Snapshot exposes `isInvulnerable`.
- **Duration:** `invincibleDurationMs: 300` in `KEY_ITEM_DEFS` (~6 ticks at `TICK_RATE = 20`). Sub-ticket 03 AC explicitly requires 300 ms; top-level ticket text says “one simulation tick.” Implementation follows sub-ticket AC and tests assert 300 ms — functionally stronger than one tick, not weaker.
- **Documentation:** `controls.md` documents ~300 ms i-frames but incorrectly labels that as “one simulation tick” (50 ms at 20 Hz). Pipeline interaction is implicit (timestamp gate in `damagePlayer`), not spelled out in docs.

Unit tests: `damagePlayer` returns null while `invulnerableUntil` is in the future; applies damage after expiry.

### Wall collision / no clipping

**Met.** Dash uses `tryPlayerMove` with `getWallColliders()`. Position updates only when `result.moved`. Unit tests cover open dash, rotation fallback, and east-wall clamp in `dodge_roll.test.js`.

### Sloped floors (`sampleFloorY`)

**Met.** After displacement, `player.y = sampleFloorY(state.layout, x, z)` with `DEFAULT_FLOOR_Y` fallback (`index.js` ~2466–2470). Capture used `sloped-dungeon` scenario (ramp screenshot `04-sloped-ramp.png`); harness did not fire dodge on the ramp, but code path is present and consistent with ticket 117 patterns.

### Client VFX + cooldown HUD

**Met (code); not exercised in capture.**

- **VFX:** `triggerDashVFX` — squash + ghost trail (`renderer.js`). Detected on local player when position jump > `(MOVE_SPEED / TICK_RATE) * 2` in `stateUpdate` (`main.js` ~960–967).
- **I-frame visual:** Semi-transparent local mesh while `isInvulnerable` (`renderer.js` ~2519–2527).
- **Cooldown HUD:** `#key-item-indicator` with persistent `.cooldown` state and countdown from `keyItemCooldownRemaining`; success/cooldown flashes on `keyItemUsed`.

Visual capture did not press key-item / dodge; screenshots show movement and sloped room only.

### Server broadcast to other clients

**Met.** `io.to(lobby.id).emit('stateUpdate', stateSnapshot())` after successful dodge (`index.js` ~2479). Integration test confirms snapshot position and `keyItemCooldownRemaining`. Remote peers reconcile via existing drift thresholds (>2.5 while moving).

### Tests

**Met.**

| Requirement | Location |
|-------------|----------|
| Cooldown gate (unit) | `dodge_roll.test.js`, `key-items.test.js` |
| I-frame blocks damage (unit) | `dodge_roll.test.js`, `server.test.js`, `simulation` via `damagePlayer` |
| Integration: move + cooldown + second fail | `integration.test.js` `Socket Integration — useKeyItem dodge_roll` |
| Snapshot after dodge | Same integration block |

`round-1/coverage.log`: 947 tests passed on changed files; `dodge_roll.test.js` (7), key-items, integration dodge tests all green.

### `game/docs/controls.md`

**Met.** Dodge Roll subsection: binding, 800 ms cooldown, direction, collision. Minor inaccuracy on tick vs 300 ms (see nits).

## Design / requirements consistency

- Aligns with server-authoritative movement and shared collision helpers (`design.md` movement/slope notes).
- No regression to `requirements.md` foundation (connect, render, sync).
- Key-item stub pattern preserved: non–`dodge_roll` items still `not_implemented`.
- Transient run state (`invulnerableUntil`, `keyItemCooldownUntil`) excluded from persistence (`key-items.test.js`).

## Debug scenarios

This ticket did **not** add or change `?debugScenario=` handlers in game code. Integration tests use pre-existing `summon-ready` via socket `debugScenario` (test-only entry). Normal lobby → ready → dungeon path remains the player flow; no invariant bypass for dodge itself.

## Code quality

- Focused diff across server handler, `damagePlayer`, client HUD/VFX, defs, tests, docs.
- No page errors; no obvious dead code in the dodge path.
- `useKeyItem` does not validate `keyItemId === equippedKeyItemId` (client sends equipped id; server trusts payload) — pre-existing pattern, low risk for current single implemented item.

## Remaining gaps

None blocking. Runtime proof is clean; acceptance criteria are implemented and tested. Spec drift on i-frame duration (top-level “one tick” vs 300 ms) is resolved in code per sub-ticket AC and is documented in nits, not as a functional defect.

## Nits (non-blocking)

See `round-1/nits.md` for backlog items: `controls.md` tick wording, visual capture omitting dodge, no client tests for VFX/HUD helpers.

VERDICT: PASS
