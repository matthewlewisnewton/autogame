# Player 1 (HOST) — Telepipe Tier 2 QA Report v2

**Date:** 2026-05-24
**Account:** `qa-telepipe-p1`
**Lobby:** `Telepipe QA v3`
**URL:** http://localhost:5173/?debugScenario=telepipe-ready
**Role:** Host (Player 1)
**Automation:** Playwright (cursor-ide-browser MCP unavailable)
**P2 join source:** bootstrap

---

## Step Results

| Step | Description | Result | Notes |
|------|-------------|--------|-------|
| 1 | Navigate + login (P1) | **PASS** | — |
| 2 | Create lobby | **PASS** | Telepipe QA v3 |
| 3 | Write coordination | **PASS** | step=lobby-created |
| 4 | Wait for P2 join | **PASS** | bootstrap |
| 5 | Screenshot lobby | **PASS** | — |
| 6 | P1 click Ready | **PASS** | — |
| 7 | Dungeon + Telepipe slot 0 | **PASS** | [{"id":"telepipe","name":"Telepipe","type":"summon","remainingCharges":1,"charges":1,"isEvolved":false},{"id":"battle_familiar","name":"Signal Familiar","type":"summon","remainingCharges":1,"charges":1,"isEvolved":false}] |
| 8 | Place telepipe (key 1) | **PASS** | — |
| 9 | P1 extract overlay | **FAIL** | screenshot captured |
| 10 | Wait for suspend | **FAIL** | banner missing |

**Overall: FAIL**

---

## Log Checklist

| Log | Expected | Observed |
|-----|----------|----------|
| `[telepipe] placed at` (server) | Yes | **No** |
| `[telepipe] player ... extracted` (socket playerExtracted) | Yes | **No** |
| `[run] checkpoint captured` (runSuspended) | Yes | **No** |
| `[run] checkpoint restored` (startGame resume) | Yes | **No** |
| No console TypeError on stateUpdate | Yes | **Yes** |

---

## Console Errors (stateUpdate/inDesperation)

None observed.

---

## Socket Events

```json
{
  "p1": [],
  "p2": []
}
```

---

## Screenshots

| Filename | Status |
|----------|--------|
| `step-v2-01-p1-lobby.png` | Captured |
| `step-v2-02-p1-dungeon.png` | Captured |
| `step-v2-03-p1-portal-placed.png` | Captured |
| `step-v2-04-p1-extracted.png` | Captured |
| `step-v2-06-p1-suspended.png` | Captured |
| `step-v2-08-p1-resumed.png` | Captured |

---

## Coordination Final State

```json
{
  "lobbyName": "Telepipe QA v3",
  "p1Ready": true,
  "p2Joined": true,
  "p2Ready": false,
  "step": "p1-extracted",
  "runId": 2,
  "p1PortalPlaced": true,
  "p1Extracted": true
}
```


**Fatal error:** page.screenshot: Target page, context or browser has been closed
