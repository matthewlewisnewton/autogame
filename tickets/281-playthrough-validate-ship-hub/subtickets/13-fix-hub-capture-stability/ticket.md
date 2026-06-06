# Fix hub capture plan selection and keep game server alive through capture

Round-3 QA capture failed (`metrics.json` `ok:false`, `capturePlanSource:fallback`, server ECONNREFUSED on the game port mid-capture) because ticket-281 hub paths outside `subtickets/` still matched the generic solo suspend→resume telepipe recipe. Extend hub abandon/reset detection and harden the playthrough driver so hub validation reaches a stable playing/suspended/fresh-deploy state without losing the server socket.

## Acceptance Criteria

- **`harness/screenshot.mjs`**: `isHubTelepipeAbandonValidateTicket()` returns true for ticket **281** when `outDirAbs` is under `…/281-playthrough-validate-ship-hub/round-*` or `game/validation/hub`, not only `…/subtickets/…`; also treat the top-level `tickets/281-playthrough-validate-ship-hub/ticket.md` (telepipe-up / hub validation prose) as hub-abandon context even when the output dir is a round folder.
- For all matched hub-abandon paths, `fallbackRecipe()` selects the suspend-only `buildSoloTelepipeSuspendThroughProbeSteps()` branch — **never** appends post-suspend `readyAll` / `03-resumed-dungeon` / checkpoint-restore steps.
- Round-level or hub-validation iter capture: `metrics.json` has `ok:true`, non-empty `screenshots`/`probes`, `capturePlanSource` not selecting suspend→resume (summary must not mention `restoreRunCheckpoint` or `resumed-dungeon`); `server.log` after suspend contains `[run] suspended` and does not contain `[run] checkpoint restored`.
- **`harness/validate/playthrough.mjs`** + **`harness/validate/lib/gameProcess.mjs`**: a `--preset hub --steps telepipe-reset` run completes without ECONNREFUSED/502 proxy errors; server process stays up through suspend → abandon → fresh deploy (server log tail present in output dir).
- **`harness/validate/presets/hub.mjs`** / **`harness/validate/lib/telepipe.mjs`**: adjust only if needed so hub telepipe-reset step tolerates restored gameplay regen (after sub-ticket **12**) and still produces `telepipeUpReset: true` when behavior is correct.
- `cd game && pnpm test:quick` passes.
- Depends on sub-ticket **12**.

## Technical Specs

- Edit: `harness/screenshot.mjs` — broaden `HUB_VALIDATE_SUBTICKETS_RE` / `isHubTelepipeAbandonValidateTicket` to cover `round-*` and `game/validation/hub`; optionally read top-level ticket path via existing `inferTicketFile()` when subticket ticket.md is absent.
- Edit: `harness/validate/playthrough.mjs` — ensure `startGame`/`stopGame` lifecycle does not tear down server mid-step; propagate `serverLogPath` through telepipe-reset; fail fast with server log tail on connection loss.
- Edit (if required): `harness/validate/lib/gameProcess.mjs`, `harness/validate/lib/telepipe.mjs`, `harness/validate/presets/hub.mjs`.
- Reference failure artifacts: `tickets/281-playthrough-validate-ship-hub/round-3/metrics.json`, `round-3/client.log`, `round-3/server.log`.
- Do **not** reintroduce gameplay changes in `game/server/` or `game/client/` beyond existing `__*ForTest` hooks.

## Verification: code
