# Findings and verifier: walkable hub presentation

Extend hub validation reporting so `findings.md` documents whether the recaptured screenshots show a walkable 3D hub (menu dismissed, canvas active, party-mate presence), and tighten `verify-hub-artifacts.mjs` so stale pre-304 captures cannot pass without walkable-presentation evidence.

## Acceptance Criteria

- `harness/validate/lib/findingsHub.mjs` adds a **Walkable presentation** section that summarizes sub-ticket **01** probes:
  - For overview + each zone (`operations`, `commerce`, `salon`): records `lobbyHidden`, `lobbyMenuDismissed`, `hubCanvasActive`, `playersOnHost`, and `remoteSquadmateCount`.
  - Includes explicit narrative bullets answering: Is the 3D hub clearly visible with the menu closed? Any remaining menu-dominance on walk captures? Are party-mates present in-world (≥2 players, ≥1 remote squadmate in harness)?
  - On probe failure (missing `walkablePresentation` or any walk capture with `lobbyHidden === false`), Outcome stays **FAIL** even if booth/telepipe asserts pass.
- `harness/validate/verify-hub-artifacts.mjs` rejects artifacts when:
  - `run-summary.json` lacks `hubWalk.walkablePresentation.overview` and per-zone entries for `operations`, `commerce`, `salon`.
  - Any stored walk probe has `lobbyHidden !== true`, `lobbyMenuDismissed !== true`, or `hubCanvasActive !== true`.
  - `hubWalk.playersOnHost < 2` or overview probe `remoteSquadmateCount < 1`.
- `findings.md` template still lists booth asserts (`boothDeductsGold`, `hatSwapFree`) and `telepipeVitalsPreserved` with existing detail helpers.
- Depends on sub-ticket **01**.

## Technical Specs

- Edit: `harness/validate/lib/findingsHub.mjs` — new `walkablePresentationNotes(summary)` helper; wire into `renderHubFindings`; optionally fold walkable probe pass/fail into top-level `run.ok` when called from `playthrough.mjs`.
- Edit: `harness/validate/verify-hub-artifacts.mjs` — `checkWalkablePresentation(summary, errors)` with the probe keys above.
- Edit (if needed): `harness/validate/playthrough.mjs` — ensure full-run `summary.ok` is false when walkable presentation probes fail (may belong here or in **01**; keep a single source of truth).
- Read-only reference: existing `game/validation/hub/run-summary.json` shape under `hubWalk`; no `game/client/` or `game/server/` gameplay edits.

## Verification: code
