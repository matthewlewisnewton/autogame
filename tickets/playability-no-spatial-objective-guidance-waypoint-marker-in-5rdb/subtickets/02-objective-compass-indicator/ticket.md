# Screen-edge objective compass for collect_items runs

Wire a visible on-screen directional indicator that points toward the nearest uncollected quest-critical prism during active `collect_items` runs. This addresses blind exploration in maze-like open layouts (e.g. Prism Salvage / `crystal_rescue` tier 1) where `#objective-hud` only shows text progress.

## Acceptance Criteria

- During `gamePhase === 'playing'` with `run.objective.type === 'collect_items'` and `collectedItems < totalItems`, a `#objective-nav-indicator` element is visible and its arrow rotates to point toward the nearest remaining crystal in `gameState.loot` (quest-critical crystals only).
- When the run is not playing, the player is in the lobby/hub, the objective is complete, or no quest-critical loot remains in `gameState.loot`, `#objective-nav-indicator` is hidden (`display: none` or equivalent).
- The indicator updates as the local player moves and as the camera yaws (uses live `getCameraYaw()` from `renderer.js`); collecting a prism retargets to the next-nearest crystal without a reload.
- Collecting the last prism hides the indicator even if `#objective-hud` still shows the quest title momentarily.
- Existing `#objective-hud` text progress for `collect_items` is unchanged; `defeat_enemies`, `stage_boss`, `escort`, and `survive` runs do not show the compass.
- Unit / integration tests assert show-hide gating and that arrow rotation calls `computeArrowRotation` with the nearest crystal; `pnpm test:quick` passes.

## Technical Specs

- **Change** `game/client/index.html` — add `#objective-nav-indicator` (child arrow element, e.g. `#objective-nav-arrow`) near the other HUD overlays; include an `aria-label` such as "Objective direction".
- **Change** `game/client/style.css` — style a fixed HUD compass (suggested: bottom-center above the card hand, `pointer-events: none`, high `z-index`, subtle dark backing, cyan accent matching prism loot). Rotate the arrow via CSS `transform: rotate(...)` on the inner element.
- **Change** `game/client/main.js`:
  - Import helpers from `objectiveNav.js` and `getCameraYaw` from `renderer.js`.
  - Add `updateObjectiveNavIndicator()` that reads `gameState`, local player position (`gameState.players[myId]`), filters loot via `findNearestQuestCriticalLoot`, sets visibility, distance-optional label (e.g. rounded meters) if desired, and applies arrow rotation from `computeArrowRotation`.
  - Call `updateObjectiveNavIndicator()` anywhere `updateObjectiveHud()` is already invoked on state/run changes, and once per frame in the existing animate/render loop so camera yaw stays in sync.
  - Hide the indicator in lobby phase alongside other dungeon-only HUD (`body[data-phase="lobby"]` rule or explicit check).
- **Add** `game/client/test/objectiveNavIndicator.test.js` (or extend `main.test.js`) with jsdom fixtures:
  - `crystal_rescue` / `collect_items` run with three crystals → indicator visible, rotation non-zero when player offset from nearest crystal.
  - All crystals collected or `gamePhase !== 'playing'` → indicator hidden.
  - `stage_boss` run → indicator hidden.
- **Optional server touch:** none required — crystal positions already sync via `gameState.loot` (`spawnCrystals` in `game/server/progression.js` sets `kind: 'crystal'`, `questCritical: true`).

## Verification: code
