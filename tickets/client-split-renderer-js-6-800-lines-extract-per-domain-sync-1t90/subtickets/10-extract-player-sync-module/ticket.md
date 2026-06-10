# Move player/avatar sync into game/client/renderer/playerSync.js

Move the player-domain mesh sync (avatars, nameplates, slow/burn/windup markers,
shadows, shield/smoke VFX, HP-drop flash) out of `renderer.js` into a real module
imported by `renderer.js`. Behavior unchanged. The one tricky part: the local
player's respawn block reassigns module-scoped *kinematic* `let`s (`myX`, `myZ`,
`simX`, `simZ`, `prevSimX`, `prevSimZ`, `moveAccumulator`, `playerRotation`,
`lastEmittedRotation`, lock-on state) — those WRITES must stay owned by
`renderer.js`. Depends on sub-ticket 06.

## Acceptance Criteria

- A new file `game/client/renderer/playerSync.js` exists and exports
  `syncPlayerMeshes(gs, myId, localKinematics)`, with avatar/nameplate/indicator
  behavior unchanged.
- Reads of local-player kinematic values inside the function (`myX`, `myZ`,
  `playerRotation`) are passed in via the `localKinematics` argument constructed
  by `renderer.js`, NOT read as cross-module mutable bindings.
- The local-player respawn-detection reset (the `if (wasDead && !isDead) { myX =
  spawnPosition.x; ... }` block plus the dead-state lock-on clears that reassign
  `renderer.js` `let`s) remains in `renderer.js` — extract it into a small
  `renderer.js`-local helper (e.g. `applyLocalPlayerRespawnReset(gs, myId)`)
  invoked from `animate()` (or have `syncPlayerMeshes` return a signal that
  `renderer.js` acts on). No cross-module reassignment of those `let`s.
- Player-only helpers used solely here (e.g. avatar HP-flash, nameplate
  create/dispose usage, card-windup-marker handling, shield/smoke VFX trigger
  glue) are imported or moved as appropriate; the mesh-map/marker stores come
  from `./rendererState.js`, generic dispose from `./meshSync.js`, and shared
  cross-cutting helpers (`flashMesh`, `applySlowIndicator`, `applyBurnIndicator`,
  `syncFlyingShadow`, `spawnDamageNumber`, `createNameplate`, `disposeNameplate`,
  `createPlayerAvatar`, `disposeAvatar`, `applyLoadedModelCosmetic`,
  `updateKeyItemProp`, `cosmeticSignature`) are imported from their owning
  module / `../renderer.js` and invoked only at call time.
- `renderer.js` no longer defines `syncPlayerMeshes` locally — it imports it from
  `./renderer/playerSync.js`; `animate()` still calls it once per frame with the
  current local kinematics.
- `pnpm test` (from `game/`) passes; game boots, two players join, WASD movement
  works, local + remote avatars/nameplates render, HP-drop flash + damage number
  fire, and respawn resets the local player to spawn (no console `pageerror`).

## Technical Specs

- New: `game/client/renderer/playerSync.js`.
- Edit: `game/client/renderer.js` — cut `syncPlayerMeshes` (~lines 6365–6627);
  add `import { syncPlayerMeshes } from './renderer/playerSync.js'`; build the
  `localKinematics` object (`{ myX, myZ, playerRotation }`) at the call site; keep
  the respawn-reset writes in a `renderer.js`-local helper. Export back any
  cross-cutting helper the module imports (call-time-only, cycle-safe).
- This is the only domain whose extraction touches local-player kinematic state —
  be conservative: do not relocate `myX`/`myZ`/`simX`/etc. or the
  movement-prediction `let`s out of `renderer.js`.
- Do NOT touch any sub-ticket folder containing a `.passed` marker.

## Verification: code
