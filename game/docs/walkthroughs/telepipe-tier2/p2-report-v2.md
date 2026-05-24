# Player 2 (JOINER) — Telepipe Tier 2 QA Report v2

**Date:** 2026-05-24
**Account:** `qa-telepipe-p2`
**Lobby:** `Telepipe QA v2`
**URL:** http://localhost:5173/?debugScenario=telepipe-ready
**Role:** Joiner (Player 2)
**Automation:** Playwright (cursor-ide-browser MCP unavailable)

---

## Step Results

| Step | Description | Result | Notes |
|------|-------------|--------|-------|
| 1 | Navigate + login | **PASS** | — |
| 2 | Poll coordination for lobby | **PASS** | waiting |
| 3 | Join lobby + set p2Joined | **PASS** | Telepipe QA v2 |
| 4 | Screenshot joined | **PASS** | — |
| 5 | Click Ready | **PASS** | — |
| ! | Fatal error | **FAIL** | page.waitForFunction: Timeout 30000ms exceeded. |

**Overall: FAIL**

---

## WebSocket Events

| Event | Expected | Observed |
|-------|----------|----------|
| `cardError` ("Telepipe already active") | Yes | **No** |
| `playerExtracted` (P1 first) | Yes | **No** |
| `runSuspended` | Yes | **No** |
| `stateUpdate` with telepipe | Yes | **No** |

---

## Socket Event Log (last 15)

```json
[
  {
    "source": "console",
    "type": "log",
    "text": "[debugScenario] applied telepipe-ready"
  },
  {
    "source": "console",
    "type": "log",
    "text": "[run] suspended: Training Caverns"
  },
  {
    "source": "console",
    "type": "log",
    "text": "[run] suspended: Training Caverns"
  }
]
```

---

## Console Errors

None observed.

---

## Screenshots

| Filename | Status |
|----------|--------|
| `step-v2-01-p2-joined.png` | Captured |
| `step-v2-02-p2-dungeon.png` | Captured |
| `step-v2-03-p2-rejected.png` | Captured |
| `step-v2-05-p2-still-playing.png` | Captured |
| `step-v2-06-p2-suspended.png` | Captured |
| `step-v2-08-p2-resumed.png` | Captured |

---

## Coordination Final State

```json
{
  "lobbyName": "Telepipe QA v2",
  "p1Ready": false,
  "p2Joined": false,
  "p2Ready": false,
  "step": "lobby-created",
  "runId": 2
}
```
