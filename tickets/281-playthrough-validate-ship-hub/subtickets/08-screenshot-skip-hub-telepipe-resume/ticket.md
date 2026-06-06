# Stop suspend/resume screenshot capture for hub telepipe validation

Round-2 QA failed because `harness/screenshot.mjs` auto-selects the solo **suspend → resume** capture recipe whenever the sub-ticket path contains `telepipe`, poisoning iter artifacts with `[run] checkpoint restored` even while implementers work on the **abandon → fresh deploy** path. Narrow `isTelepipeTicket` so ticket 281 hub telepipe-reset validation sub-tickets use a suspend-only capture (or base smoke) that never calls `readyAll` after suspend.

## Acceptance Criteria

- In `harness/screenshot.mjs`, ticket paths under `281-playthrough-validate-ship-hub/subtickets/` whose folder name or `ticket.md` prose references `telepipe-reset`, `telepipe-abandon`, `abandon-fresh`, or `abandonSuspendedRun` are **excluded** from the existing `isTelepipeTicket` suspend/resume branch.
- For those hub-validation tickets, the fallback capture plan is a new **solo suspend-only** recipe: auth → solo lobby → `telepipe-ready` → deploy → place telepipe → wait past `PORTAL_PLACEMENT_GRACE_MS` → solo extract until suspended lobby — then **stop** (no `readyAll`, no `restoreRunCheckpoint`, no `03-resumed-dungeon.png`).
- Iter capture artifacts for this sub-ticket: `metrics.json.capturePlanSummary` must **not** mention `restoreRunCheckpoint` or `resumed-dungeon`; `server.log` after suspend must contain `[run] suspended` and must **not** contain `[run] checkpoint restored`.
- Suspended-state probe in `metrics.json` records `runStatus === 'suspended'` or lobby with `suspendedRunSummary`, and `abandonRunBtnUsable === true` once sub-ticket 09 lands (pass on code if probe field absent this iteration).
- No changes to passed sub-tickets 01–03 or 05 artifacts under `game/validation/hub/`.
- `cd game && pnpm test:quick` still passes.

## Technical Specs

- Edit: `harness/screenshot.mjs` — add `isHubTelepipeAbandonValidateTicket(ticket, outDirAbs)` helper; guard `isTelepipeTicket` with `&& !isHubTelepipeAbandonValidateTicket(...)`; add suspend-only step array mirroring the existing telepipe branch through `02-suspended-lobby` probe but omitting resume steps.
- Reference: existing `isTelepipeTicket` block (~lines 346–505) for solo deploy / telepipe placement timing.
- Constants: `PORTAL_PLACEMENT_GRACE_MS` from `game/server/config.js` (already imported in screenshot.mjs or require inline).
- Do **not** edit `harness/validate/**` or game source in this sub-ticket.

## Verification: code
