# Cleanup nits from 091-cleanup-audit-client-server

> **Staleness note.** This follow-up ticket was written against commit
> `1c3eb95` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `091-cleanup-audit-client-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Visual capture did not exercise summon card use

Review-round-1 probes show Flame Blade charge 3→2 while Battle Familiar and MS (100/100) were unchanged, so screenshot `02-after-summon.png` does not validate the redraw-drift fix in the browser. The code change is correct; harness capture should press slot 0 (summon) and assert hand/MS change via `stateUpdate`.
### Acceptance Criteria
- Capture plan for this ticket includes a probe after using a summon card with decreased MS and a replaced hand slot per server state.
- `metrics.json` probes document summon slot id/charges before and after, not only a weapon card.

## Monster cards still use optimistic client redraw

`useCard` still nulls the slot and calls `drawCard()` for `monster` cards (~403–408 in `game/client/main.js`) while summons wait for server authority. The same transient drift the ticket fixed for summons may still appear for monsters until reconciled solely via `stateUpdate`.
### Acceptance Criteria
- Monster card confirmation does not call client-side `drawCard()` after the server emits authoritative hand state.
- Hand slot updates for monster plays come from `stateUpdate` reconciliation only.

## Swept-collision logging is downgraded but not throttled

`console.debug` prevents warn-level spam but full stdout (e.g. harness `server.log`) still receives one line per rejected move tick (~57 lines in review capture). Optional per-socket throttle would shrink volume further without losing malformed-payload `console.warn` diagnostics.
### Acceptance Criteria
- Repeated swept-collision rejections for the same socket emit at most one debug line per N ms (e.g. 500–1000 ms).
- First rejection after idle still logs immediately; invalid move payloads remain `console.warn`.
