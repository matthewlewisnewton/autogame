# Senior Review — playability: selecting a new quest is ignored when a suspended run exists

## Runtime health — PASS
`round-1/metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`
block, servers started (url http://localhost:5177/). `console.log` shows only
benign noise (vite connect, a transient 401/409 during the deterministic
auth/lobby smoke, `initScene`, `launchBooth ready-up`) — no `pageerror` or
`[fatal]` lines from game code. The game starts and loads cleanly.

Note: the capture used the deterministic **fallback** full-flow smoke
(`capturePlanSource: "fallback"`), so it did not exercise the
suspend→reconnect→reselect scenario in-browser. Runtime health is proven, and
the specific scenario is covered thoroughly by server integration + unit tests
(see below), all green.

## Ticket goal
The bug: with a suspended checkpoint, readying up always RESUMED the old run
(`checkAllReadyInner`: `if (_gameState.suspendedCheckpoint) { restoreCardCheckpoint(); return; }`),
silently ignoring a newly-selected quest. The server also rejected SELECT_QUEST
outright while suspended, and the client locked quest selection — so selecting a
new quest "did nothing".

## Per-criterion findings

### EXPECTED: selecting a different quest then deploying starts that quest — PASS
Three coordinated changes implement this:

1. **Server SELECT_QUEST** (`game/server/socketHandlers/lobbyHandlers.js`): the
   blanket `suspendedCheckpoint` rejection is replaced with a quest-aware check.
   Same quest+tier as the checkpoint → still rejected (`suspended_checkpoint`,
   preserves resume semantics). Different quest+tier → `abandonSuspendedRun(state)`
   clears the checkpoint and selection proceeds. Variables in scope verified
   (`DEFAULT_QUEST_TIER`, `normalizeQuestTier` imported; `state.suspendedCheckpoint.run.questId/questTier` populated by `captureCardCheckpoint`).

2. **Server checkAllReadyInner** (`game/server/progression.js:3948`): resume now
   only fires when `cp.run.questId === questId && cp.run.questTier === selectedTier`;
   otherwise it falls through to a fresh deploy that applies the selected quest's
   layout via `_applyLayoutForQuest`. This is a correct safety net even though
   path (1) already clears the checkpoint on a quest change. `questId`/`selectedTier`
   are in scope from the enclosing block.

3. **Client** (`game/client/main.js`): the two `if (suspendedRunSummary) { showQuestError(...); return; }`
   early-returns are removed and `selectionLocked` is hard-set to `false`, so the
   quest board and level-map nodes emit SELECT_QUEST while a suspended run exists.

Flow holds end-to-end: select different quest → `abandonSuspendedRun` (clears
checkpoint, resets ready flags, emits `runAbandoned` + state) → ready up →
`checkAllReadyInner` sees no checkpoint → fresh deploy with the new quest's
layout/objective and a new run id.

### EXPECTED: same quest still resumes — PASS
Same quest+tier reselect is rejected server-side; deploying resumes via
`restoreCardCheckpoint` (run id, layout, objective progress, card charges
preserved). Consistent with `game/docs/design.md` lines 37–39.

### Design consistency / no regression — PASS
design.md models "new sortie discards the suspended checkpoint, fresh run." This
ticket adds an ergonomic path to that same end-state (selecting a different quest
implicitly abandons), rather than forcing the player through "Abort Sortie".
No invariant is weakened: a quest change goes through the real `abandonSuspendedRun`
+ fresh-deploy + `_applyLayoutForQuest` path; nothing is short-circuited. No
debug scenario was added or changed by this ticket.

### Tests / quality — PASS
`npx vitest run` on the three touched suites: **792 passed**. New, targeted
coverage:
- `server.test.js`: `checkAllReady` starts a fresh run (new run id, new questId/tier)
  when selected quest differs from the suspended checkpoint — exercises the safety net.
- `integration.test.js`: SELECT_QUEST rejects same quest+tier (checkpoint preserved);
  accepts a different quest, emits `runAbandoned`, clears the checkpoint, updates
  selection to the new quest.
- `main.test.js`: client emits SELECT_QUEST from quest card and level-map node
  while `suspendedRunSummary` is set; banner clears after the quest change.

## Remaining gaps
None blocking. Two minor nits captured in `nits.md` (a now-dead
`THEME.run.questSuspendedLocked` reference in `clearSuspendedRunUi`, and the
absence of a client handler for the server's `suspended_checkpoint` quest error
so a same-quest reselect is silently a no-op). Neither affects the acceptance
criteria.

VERDICT: PASS
