# Extract `playerSync` module (positioning, nameplates, status VFX)

Move the remaining per-player `animate()` logic — remote/local positioning, nameplate sync, status indicators, local-player respawn/invuln/shield handling, smoke-bomb VFX, and phase-step highlight — into a `playerSync` module. Avatar rebuild stays in `avatarSync` (sub-ticket 03).

## Acceptance Criteria

- New module `game/client/renderer/playerSync.js` exports a frame entry point (e.g. `syncPlayersFrame({ gs, myId, delta, myX, myZ, playerRotation, ... })`) that handles:
  - Remote player position/rotation/death tint and HP-drop red flash + `previousPlayerHp` tracking
  - Local player floor-snapped position, rotation, respawn detection, invulnerability shimmer, shield VFX follow, HP-drop flash + damage number
  - Nameplate create/update/dispose for self and remotes; cleanup for departed players
  - Slow, burn, and card-windup indicators (`applySlowIndicator`, `applyBurnIndicator`, `applyPlayerCardWindupIndicator`) including local predicted `myX`/`myZ` anchoring
  - Smoke-bomb VFX re-trigger loop and `syncPhaseStepAllyHighlight`
  - Cleanup of slow/burn/windup markers for players who left
- `animate()` contains no inline player positioning, nameplate, or status-indicator code; it calls `playerSync.syncPlayersFrame` after `avatarSync`.
- `boothPrompt.test.js`, `hub-lobby-render.test.js`, `renderer-shield-bar.test.js`, and player-facing tests in `main.test.js` pass.
- `getMeshMaps()` still exposes `playersMeshes`, `playerNameplates`, and related maps for tests.

## Technical Specs

- **Add** `game/client/renderer/playerSync.js`.
- **Change** `game/client/renderer.js` — remove player-loop body from `animate()` (~6225–6419 plus smoke/phase-step ~6421–6434); import `playerSync`; pass mutable local-player state (`myX`, `myZ`, `wasDead`, `spawnPosition`, lock-on clears on respawn) by reference or return struct.
- **Dependencies:** requires sub-tickets 01–03 landed (`avatarSync` runs first each frame).
- Re-export any player-sync symbols tests import from `renderer.js` (`updateMyPlayer` stays in renderer; only per-frame mesh sync moves).

## Verification: code
