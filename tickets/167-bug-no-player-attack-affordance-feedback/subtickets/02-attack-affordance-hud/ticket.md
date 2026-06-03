# On-screen attack affordance (reticle + hint)

Give a new player a clear, always-visible cue for how to attack during a run.
Add a center-screen aiming reticle/crosshair plus a short instructional hint
(e.g. "Click or press 1–4 to attack") that is shown while in a dungeon run and
hidden in the lobby and overlays.

## Acceptance Criteria

- A reticle/crosshair element is rendered at screen center and an attack hint
  label exists in the HUD markup.
- Both are visible only while `gamePhase === 'playing'` and hidden in the
  lobby, login, and other overlay states.
- The hint text names a concrete way to attack (clicking the canvas and/or the
  hand-slot keys), consistent with the card-slot controls already shown.
- The reticle/hint are non-interactive (`pointer-events: none`) so they never
  intercept the canvas basic-attack click from sub-ticket 01.
- Styling uses the existing theme tokens/CSS conventions; no layout regressions
  to the existing card hand or HUD.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/index.html`: add the reticle and hint elements inside the
  in-run HUD container (near the existing card hand `#card-hand` / HUD overlay).
  Give them stable ids/classes (e.g. `#attack-reticle`, `#attack-hint`).
- `game/client/*.css` (the stylesheet linked from `index.html`): center the
  reticle, set `pointer-events: none`, and style per existing theme variables.
- `game/client/main.js`: toggle visibility from the same place the run/lobby
  phase is applied (where `gamePhase`/`setGamePhase` transitions are handled and
  other HUD elements are shown/hidden for `'playing'`). Show on `'playing'`,
  hide otherwise.
- Do not change combat logic — this sub-ticket is purely the visible
  affordance. The actual click-to-attack wiring lives in sub-ticket 01.

## Verification: code
