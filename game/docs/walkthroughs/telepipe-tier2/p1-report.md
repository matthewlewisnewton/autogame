# Player 1 (HOST) — Telepipe Tier 2 QA Report

**Date:** 2026-05-24  
**Account:** `qa-telepipe-p1`  
**Lobby:** `Telepipe QA`  
**URL:** http://localhost:5173/?debugScenario=telepipe-ready  
**Role:** Host (Player 1)

---

## Step Results

| Step | Description | Result | Notes |
|------|-------------|--------|-------|
| 1 | Register account (`qa-telepipe-p1` / `testpass123`) | **PARTIAL PASS** | Register form submitted; account already existed from prior session, completed via Login instead. |
| 2 | Create lobby named `Telepipe QA` | **PASS** | Create Lobby with exact name succeeded. |
| 3 | Write coordination file | **PASS** | `coordination.json` written and updated through walkthrough. |
| 4 | Screenshot `step-01-p1-lobby-host.png` | **PARTIAL PASS** | Screenshot captured, but page had already transitioned to dungeon gameplay (P2 may have triggered early start). |
| 5 | Wait for P2 join | **PASS** | Coordination showed `p2Joined: true`; lobby listed 2 players. |
| 6 | Click Ready (`#ready-btn`), set `p1Ready: true` | **PARTIAL PASS** | Ready clicked; button changed to "Ready!" but player list still showed P1 as "Not Ready". "Run Failed" overlay text appeared in DOM. |
| 7 | Dungeon start screenshot `step-02-p1-dungeon-start.png` | **PASS** | Training Caverns dungeon visible with card hand and enemies. |
| 8 | Use telepipe card (key `1` / first slot) | **FAIL** | Hand contained Iron Sword, Flame Blade, Battle Familiar, Dungeon Drake — **no Telepipe card**. Debug scenario `telepipe-ready` should inject Telepipe into first hand slot per server code. |
| 9 | Extract via portal → `step-04-p1-extracted-lobby-overlay.png` | **NOT REACHED** | No telepipe placed; extraction not attempted. |
| 10 | Wait for suspend → `step-06-p1-suspended-banner.png` | **NOT REACHED** | — |
| 11 | Ready for resume → `step-08-p1-resume-dungeon.png` | **NOT REACHED** | — |
| 12 | Abandon / complete run | **NOT REACHED** | — |

**Overall: FAIL** — Blocked at step 8 by missing Telepipe card and client-side socket handler crash.

---

## Screenshots Captured

| Filename | Step | Status |
|----------|------|--------|
| `step-01-p1-lobby-host.png` | 4 | Captured (shows dungeon, not lobby UI) |
| `step-02-p1-dungeon-start.png` | 7 | Captured |
| `step-03-p1-portal-placed.png` | 8 | **Not captured** |
| `step-04-p1-extracted-lobby-overlay.png` | 9 | **Not captured** |
| `step-06-p1-suspended-banner.png` | 10 | **Not captured** |
| `step-08-p1-resume-dungeon.png` | 11 | **Not captured** |

Screenshots saved under `game/docs/walkthroughs/telepipe-tier2/`.

---

## Console / WebSocket Observations

### Critical client error (repeated on every `stateUpdate`)

```
TypeError: Assignment to constant variable.
    at Socket.<anonymous> (http://localhost:5173/main.js:579:19)
```

**Root cause:** `main.js` imports `inDesperation` from `hand.js` and attempts reassignment at line 579:

```javascript
inDesperation = !!serverPlayer.inDesperation;
```

ES module imports are read-only bindings; reassignment throws. This breaks hand reconciliation on every server state push.

### Other observations

- **HP display:** `0/100` during dungeon (expected 100/100 from `telepipe-ready` scenario). Likely stale/broken UI due to handler crash.
- **Heartbeat:** Outbound `heartbeat` messages observed.
- **Expected events NOT captured:** `cardUsed`, `playerExtracted`, `runSuspended`, `stateUpdate` with `telepipe` field — walkthrough did not reach those flows; WebSocket hook was installed after initial connection so inbound event capture was incomplete.
- **"Run Failed" overlay** appeared in DOM after clicking Ready (possible stale state from prior failed run or race with P2).

---

## Blockers

1. **Client bug — `inDesperation` reassignment** (`game/client/main.js:579`, also `:1293`): Crashes state sync on every socket update. Must fix before reliable telepipe QA.
2. **Telepipe card missing from hand:** Despite `debugScenario=telepipe-ready`, P1 hand had standard deck cards only. Server scenario replaces first occupied hand slot with Telepipe at run start — either scenario not applied or hand redraw overwrote it.
3. **Race / premature start:** Game entered dungeon before P1 explicitly clicked Ready; step-01 screenshot captured mid-dungeon.
4. **Browser MCP disconnect:** cursor-ide-browser tools became unavailable mid-walkthrough; could not unlock browser or complete steps 8–12.

---

## Coordination File Final State

```json
{"lobbyName":"Telepipe QA","p1Ready":true,"p2Joined":true,"step":"p1-ready","p1Url":"http://localhost:5173/?debugScenario=telepipe-ready"}
```

---

## Recommended Next Steps

1. Fix `inDesperation` import reassignment in `main.js` (use a setter exported from `hand.js` instead).
2. Verify `telepipe-ready` debug scenario applies Telepipe to P1 hand at dungeon start.
3. Re-run P1+P2 walkthrough from lobby-created step with fresh accounts or server reset.
4. Confirm Ready state sync and eliminate "Run Failed" ghost overlay before dungeon entry.
