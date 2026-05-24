# Player 2 (JOINER) — Telepipe Tier 2 QA Report

**Date:** 2026-05-24  
**Account:** `qa-telepipe-p2`  
**Lobby:** `Telepipe QA`  
**URL:** http://localhost:5173/?debugScenario=telepipe-ready  
**Role:** Joiner (Player 2)  
**Browser tab:** Separate new tab (viewId `924bf1`)

---

## Step Results

| Step | Description | Result | Notes |
|------|-------------|--------|-------|
| 1 | Open new tab with `debugScenario=telepipe-ready` | **PASS** | New tab opened at correct URL. |
| 2 | Register account (`qa-telepipe-p2` / `testpass123`) | **PARTIAL PASS** | Register submitted; account already existed, completed via Login. |
| 3 | Poll coordination until `lobbyName` exists | **PASS** | Waited for `Telepipe QA` in coordination file (~30s). |
| 4 | Join lobby `Telepipe QA` | **PARTIAL PASS** | First join via Drop In (lobby showed "In run"); later rejoined via Join after leaving lobby. |
| 5 | Update coordination `p2Joined: true` | **PASS** | Written to `coordination.json`. |
| 6 | Screenshot `step-01-p2-joined-lobby.png` | **PARTIAL PASS** | Captured; shows dungeon UI (game started before lobby screenshot). |
| 7 | Click Ready, wait for dungeon start | **PARTIAL PASS** | Ready clicked ("Ready!" state); dungeon entered on retry. Multiple premature run failures occurred. |
| 8 | Screenshot `step-02-p2-dungeon-start.png` | **PASS** | Training Caverns visible; HP 100/100 on retry. First attempt captured Run Failed overlay. |
| 9 | Try telepipe (key `1`) — expect `cardError` "Telepipe already active" | **FAIL** | Hand had Iron Sword / Battle Familiar only — **no Telepipe card**. Key `1` used Iron Sword. Run ended with Run Failed (HP 0/100) before P1 portal placement could be tested. |
| 10 | Screenshot `step-03-p2-telepipe-rejected.png` | **FAIL** | Captured Run Failed screen, not telepipe rejection toast. |
| 11 | Verify P2 still in dungeon while P1 extracts | **NOT REACHED** | P2 died twice (~26s, ~50s) with 0 enemies defeated. |
| 12 | Screenshot `step-05-p2-still-in-dungeon.png` | **NOT REACHED** | — |
| 13 | Move to portal, enter PORTAL_RADIUS | **NOT REACHED** | — |
| 14 | Screenshot `step-06-p2-both-suspended.png` | **NOT REACHED** | — |
| 15 | Ready for resume with P1 | **NOT REACHED** | — |
| 16 | Screenshot `step-08-p2-resume-portal-same-position.png` | **NOT REACHED** | — |

**Overall: FAIL** — Blocked by repeated run failures, missing Telepipe card, and inability to complete telepipe rejection / suspend / resume flow.

---

## Screenshots Captured

| Filename | Step | Status |
|----------|------|--------|
| `step-01-p2-joined-lobby.png` | 6 | Captured (dungeon UI, not lobby) |
| `step-02-p2-dungeon-start.png` | 8 | Captured (first attempt — Run Failed overlay) |
| `step-02-p2-dungeon-start-retry.png` | 8 | Captured (retry — HP 100/100, black canvas) |
| `step-03-p2-telepipe-rejected.png` | 10 | Captured (Run Failed, not telepipe error) |
| `step-05-p2-still-in-dungeon.png` | 12 | **Not captured** |
| `step-06-p2-both-suspended.png` | 14 | **Not captured** |
| `step-08-p2-resume-portal-same-position.png` | 16 | **Not captured** |

---

## Console / WebSocket Observations

### Expected events — NOT observed

| Event | Expected | Observed |
|-------|----------|----------|
| `cardError` ("Telepipe already active") | After P2 uses telepipe while P1 portal active | **No** — no Telepipe in hand; no toast captured |
| `playerExtracted` (P1 only first) | P1 enters portal | **No** — flow not reached |
| `runSuspended` | Both players at portal | **No** — flow not reached |
| `stateUpdate` with telepipe coords | Portal placed | **No** — socket hook failed (`socket` not globally accessible) |

### Other observations

- **Hand contents at dungeon start:** Slots 0–3 showed Iron Sword (×2) and Battle Familiar (×2). No Telepipe despite `debugScenario=telepipe-ready`.
- **Run failures:** P2 reached Run Failed twice with 0/5 enemies defeated, HP 0/100, durations 26s and 50s. Suggests spawn damage, desync, or client state handler crash (see P1 report: `inDesperation` reassignment bug).
- **Coordination races:** Lobby list alternated between "In run" (Drop In) and "Waiting" (Join) as P1/P2 cycled through failed runs independently before final rejoin.
- **Browser MCP disconnect:** cursor-ide-browser tools became unavailable after leaving lobby for rejoin; browser could not be unlocked programmatically.

---

## Blockers

1. **Same as P1 — missing Telepipe card:** `telepipe-ready` scenario did not inject Telepipe into P2 hand.
2. **Same as P1 — client `inDesperation` crash:** Likely breaks state sync; may explain HP 0/100 and rapid run failures.
3. **Desynced run starts:** P2 entered dungeon via Drop In / Ready while P1 was in separate failed runs; caused repeated Run Failed before coordinated walkthrough.
4. **Browser MCP disconnect:** Could not complete steps 11–16 or unlock browser.

---

## Coordination File Final State

```json
{
  "lobbyName": "Telepipe QA",
  "p1Ready": false,
  "p2Joined": true,
  "step": "p2-rejoined-lobby",
  "p1Url": "http://localhost:5173/?debugScenario=telepipe-ready",
  "p2Note": "P2 rejoined via Join; waiting for coordinated Ready with P1"
}
```

---

## Recommended Next Steps

1. Fix `inDesperation` reassignment bug in `game/client/main.js` (see P1 report).
2. Verify `telepipe-ready` applies to **both** players at run start.
3. Reset server state; re-run with synchronized lobby join → both Ready → single shared run.
4. Re-attempt P2 walkthrough steps 9–16 after blockers resolved.
