# Harness: post-304 lobby waits and hub-walk walkable probes

Update the hub validation driver so create/join waits match ticket **304** (hub join starts with `#lobby` dismissed and the 3D canvas unobstructed), and record hard gates before hub-walk screenshots so captures cannot pass while the 2D lobby menu still dominates the frame.

## Acceptance Criteria

- `harness/validate/lib/multiPlayer.mjs` `createLobby` and `joinLobby` no longer wait for `#lobby` to lose `.hidden`; they wait for the same post-304 hub-ready contract as `game/client/scripts/test-hub-lobby-visible.mjs`: `phase === 'lobby'`, `layout.profile === 'hub'`, `layout.roomCount === 3`, `hasCanvas === true`, `lobbyMenuDismissed === true`, and `#lobby` has class `hidden`.
- `harness/validate/playthrough.mjs` adds a `probeWalkableHubPresentation(page)` helper (or equivalent) that returns `{ lobbyHidden, lobbyMenuDismissed, hubCanvasActive, playersOnHost, remoteSquadmateCount, layoutProfile }` using harness state and DOM checks.
- `runHubWalkStep` calls the probe immediately before writing `01-hub-overview.png` and before each zone screenshot (`02`–`04`); if `lobbyHidden !== true`, `lobbyMenuDismissed !== true`, or `hubCanvasActive !== true`, the step throws with probe JSON (fail fast — do not capture menu-dominated frames).
- `runHubWalkStep` return value includes `walkablePresentation: { overview: probe, zones: { operations, commerce, salon } }` persisted into `run-summary.json` / `probes.json` via existing artifact writers.
- Party presence unchanged: host still has `players >= 2` and remote squadmate position updates after joiner nudge before the overview screenshot.
- No edits under `game/client/` or `game/server/` (304 already landed the gameplay fix).

## Technical Specs

- Edit: `harness/validate/lib/multiPlayer.mjs` — replace post-click `#lobby` visibility waits with dismissed-hub lobby waits; keep `waitForHubLobby` as the shared waiter or fold the new checks into it.
- Edit: `harness/validate/playthrough.mjs` — `probeWalkableHubPresentation`, integrate into `runHubWalkStep` before each walk screenshot; extend `hubWalk` summary object with `walkablePresentation`.
- Reference (read-only): `game/client/main.js` (`dismissGameLobby`, `lobbyMenuDismissed` on lobby join), `game/client/scripts/test-hub-lobby-visible.mjs` for expected DOM/harness shape.
- Writable at runtime (later sub-ticket): `game/validation/hub/probes.json`, `game/validation/hub/run-summary.json` fields under `hubWalk.walkablePresentation`.

## Verification: code
