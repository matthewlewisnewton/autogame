# Harness: walkable-hub review capture (round-2 blocker)

Round-1 review capture failed with `metrics.json` `"ok": false` because the fallback plan matched ticket **305**'s telepipe prose and ran the stale solo suspend→resume branch ending in `assertRunPreserved` (incompatible with post-287 fresh redeploy). Route this ticket's review capture to a deterministic **walkable hub** fallback plan instead — two players in the ship hub with the menu dismissed, canvas active, and a remote squadmate visible — so `harness/screenshot.mjs` exits cleanly without touching `game/` or `harness/validate/*`.

## Acceptance Criteria

- Ticket **305** (top-level `ticket.md`, `round-*` folders, and subticket paths under `305-recapture-walkable-hub-after-overlay-fix`) no longer matches `isTelepipeTicket` and does **not** run `assertRunPreserved`.
- `fallbackRecipe()` selects a new walkable-hub branch when `isWalkableHubRecaptureTicket(ticket, outDirAbs)` is true (match ticket id/prose such as `305-recapture-walkable-hub`, `recapture-walkable-hub`, `walkable hub`, `game/validation/hub`; match the same patterns in `outDirAbs`).
- The walkable-hub fallback steps: two-player auth → create/join lobby → **post-304 hub-ready wait** (`phase === 'lobby'`, `layout.profile === 'hub'`, `layout.roomCount === 3`, `#lobby` has class `hidden`, `lobbyMenuDismissed === true`, live canvas) → joiner WASD nudge so remote squadmate position updates → `01-hub-overview` screenshot + probe on host → `assertWalkableHubPresentation` (or equivalent) requiring `lobbyHidden`, `lobbyMenuDismissed`, `hubCanvasActive`, `playersOnHost >= 2`, `remoteSquadmateCount >= 1`.
- Review capture artifacts report success: `metrics.json` has `"ok": true`, `"capturePlanSource": "fallback"`, `capturePlanSummary` describes walkable hub (not telepipe suspend/resume), `scenarios` is empty or does not include `telepipe-ready`, and `console.log` / `metrics.json` contain no `assertRunPreserved` / `Telepipe run-preservation assertion failed` error.
- No edits under `game/` or `harness/validate/*`.

## Technical Specs

- Edit: `harness/screenshot.mjs` only.
  - Add `WALKABLE_HUB_RECAPTURE_RE` and `isWalkableHubRecaptureTicket(ticket, outDirAbs)`.
  - Guard `isTelepipeTicket` with `!isWalkableHubRecaptureTicket(...)`.
  - Add `buildWalkableHubReviewCaptureSteps()` (two-player hub join, no `readyAll` / dungeon deploy).
  - Add allowlisted actions as needed: `waitForHubLobby` (mirror post-304 checks from `harness/validate/lib/multiPlayer.mjs` `hubLobbyReadyCheck` / `waitForHubLobby`) and `assertWalkableHubPresentation` (mirror probe fields from `harness/validate/playthrough.mjs` `probeWalkableHubPresentation` / `assertWalkableHubPresentation`).
  - Wire the new branch in `fallbackRecipe()` **before** the `isTelepipeTicket` / `isPersistVitalsTelepipe` branches (same priority pattern as ticket **287** vitals routing).
  - Register new actions in `ACTIONS` and implement handlers in `executeRecipe`.
- Read-only references: `harness/validate/lib/multiPlayer.mjs`, `harness/validate/playthrough.mjs` (hub waits and walkable presentation probes — do not import from `harness/validate/*`; inline equivalent logic in `screenshot.mjs` to respect scope).
- Optional sanity check (implementer): `node harness/screenshot.mjs <clientUrl> /tmp/hub-capture-test` with `CAPTURE_PLAN_AGENT=fallback` from a **305** `round-*` artifact dir layout is not required for QA, but the code path must be reachable when the harness review step runs.

## Verification: code
