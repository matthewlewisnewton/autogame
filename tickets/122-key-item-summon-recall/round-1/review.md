# Senior Review — Ticket 122: Key Item Summon Recall

**Baseline:** `0eed0813977c3bffe3cc5b321084c6f676142c33`  
**Implementation commit:** `5996c51` — `122-key-item-summon-recall/01-main: implement Recall Whistle key item`  
**Changed files:** `game/server/index.js`, `game/server/progression.js`, `game/server/test/key-items.test.js`

---

## Runtime health (capture proof)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | Absent |
| `console.log` fatal/pageerror | None (`pageerror` / `[fatal]` tags absent) |

`console.log` shows only Vite connect lines, two HTTP 409 responses (auth/session noise, not game crashes), and `[initScene]` for both players. Scene initialized, `phase: "playing"`, canvas present in probes.

**Verdict on runtime:** Game starts and loads cleanly for this capture.

**Capture limitation:** `capturePlanSource` is `fallback` (lobby → gameplay movement smoke). Probes show `minions: []` and screenshots do not exercise Recall Whistle. Acceptable for `Verification: code` given server tests, but visual proof of recall was not captured.

---

## Acceptance criteria

### Cooldown ~8–12s in `KEY_ITEM_DEFS`

`game/server/progression.js` defines `summon_recall` with `cooldownMs: 10000` (10s), within the 8–12s band. Applied in `useKeyItem` via `player.keyItemCooldownUntil = now + (def.cooldownMs || 10000)`.

### No minions → soft-fail, no cooldown burn

When `state.minions.filter(m => m.ownerId === socket.playerId)` is empty, server emits `keyItemUsed` `{ ok: false, reason: 'no_minions' }` and returns **before** setting cooldown. Covered by `soft-fails with no_minions reason when player has no minions`.

Client surfaces failures via `console.warn` (same pattern as other non-cooldown key-item failures); no dedicated HUD toast — server contract is met.

### Valid walkable positions (`isInsideDungeon` / `sampleFloorY`)

Recall path:

1. Ring target from player position + angle.
2. `clampToDungeon`.
3. `isEntityPositionBlocked` / `isInsideDungeon` with `nearbySpawnPosition` fallback.
4. Spiral search (radius up to 6) if still blocked.
5. `sampleFloorY` + `DEFAULT_FLOOR_Y` for `minion.y`.

Wall-clamp test places player against a wall and asserts recalled minions are unblocked and moved.

### Minions in ring (~1.5–2.5m); retain HP/TTL/AI state

`ringRadiusMin: 1.5`, `ringRadiusMax: 2.5` in defs; implementation uses midpoint **2.0m** for all minions, spread by angle `(2πi)/n`. Angular spread satisfies “ring”; radius is within spec (not per-minion random radius in the 1.5–2.5 band — see nits).

Only `x`, `z`, and `y` are mutated; `hp`, `ttl`, and other fields untouched (tests assert HP/TTL; AI fields implicitly preserved).

### Socket/state broadcast

On success: `keyItemUsed` with `recalled` count, then `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`. Dedicated test awaits `stateUpdate` with updated minion positions.

### Tests

`game/server/test/key-items.test.js` — six `summon_recall` cases:

- Two minions recall near player (distance checks, position change).
- `no_minions` soft-fail, cooldown not burned.
- Other owner’s minion untouched.
- HP/TTL retained.
- `stateUpdate` broadcast.
- Wall-adjacent clamp.

All 19 tests in the file passed when run locally. `coverage.log` records the summon_recall suite passing.

### Lobby equip list (118 defs)

`KEY_ITEM_DEFS.summon_recall` updated to **Recall Whistle** (was stale “Summon Recall” teleport copy). Defs sent on session payload (`keyItemDefs: KEY_ITEM_DEFS`). `getUnlockedKeyItems()` includes `summon_recall`. Client test `renderKeyItemList` / equip click covers `summon_recall` id (mock defs in test are slightly stale names — nit).

---

## Design & requirements consistency

- Aligns with design doc: creature cards spawn persistent minions; recall repositions allies without resetting run checkpoint semantics.
- Corrects prior wrong def (player teleport to “most recent summon location”) to minion ring recall per ticket.
- No regression to lobby/run suspend model; change is scoped to `useKeyItem` + defs + debug scenario + tests.
- Floor sampling (ticket 117) integrated for recalled minion `y`.

---

## Code quality

- Follows `dodge_roll` `useKeyItem` structure (phase check, cooldown, implement branch, persist, broadcast).
- Wall handling reuses existing dungeon helpers (`clampToDungeon`, `isEntityPositionBlocked`, `nearbySpawnPosition`).
- No dead code observed in the diff.
- Comment documents no cooldown on `no_minions` soft-fail.

---

## Debug scenario: `summon-recall`

| Requirement | Status |
|-------------|--------|
| Gated to debug/dev path only | Yes — `DEBUG_SCENARIOS` + `isDebugScenarioAllowed` (localhost / `ALLOW_DEBUG_SCENARIOS=1`; disabled in production). Socket `debugScenario` is the entry point. |
| Same end-state reachable in normal play | Yes — minions come from creature/spell summons in dungeon; whistle equipped via lobby `equipKeyItem`; `useKeyItem` runs the same handler. |
| Does not weaken server validation | Yes — scenario only seeds state (two minions, equipped whistle, playing phase). Recall still runs full `useKeyItem` logic including collision/floor checks. |

---

## Integration notes

- Harness fallback capture did not press the recall key or spawn minions in-browser; functional proof is unit/integration tests, not screenshots.
- `useKeyItem` does not require `keyItemId === player.equippedKeyItemId` (client sends equipped id — same as dodge roll).
- Emergency spiral placement can place minions farther than 2.5m when ring slots are walled — intentional escape hatch, tested up to ~7m in wall test.

---

## Remaining gaps

None blocking. Runtime clean; acceptance criteria met in server code and tests.

---

## Nits (non-blocking)

See `nits.md` for backlog items (stale client test mock, optional HUD for `no_minions`, fixed ring radius, agent-guided capture for recall).

VERDICT: PASS
