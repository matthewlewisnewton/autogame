# Wire the boss-encounter HUD into the live render loop

Connect the boss-encounter HUD module (from sub-ticket 01) to the running game
so the boss bar appears whenever a stage-boss encounter is active or locked,
driven by the real server encounter state and enemy list, for every per-level
stage boss.

## Acceptance Criteria

- `game/client/main.js` imports `buildBossEncounterModel` and
  `syncBossEncounterHud` from `./boss-encounter-hud.js` and looks up the
  `#boss-encounter-hud` DOM element refs added in sub-ticket 01.
- On each render/state update, `main.js` builds the model from the live
  `gameState.run.encounter`, `gameState.enemies`, and the existing
  `enemyDisplayCatalog`, and calls `syncBossEncounterHud` so the boss bar:
  - is shown while the encounter phase is `active` or the encounter is locked
    and the boss enemy is alive,
  - tracks the boss enemy's current HP as it changes,
  - is hidden when there is no encounter, the encounter is dormant/cleared, or
    the boss is dead/absent.
- The boss display name and HP shown come from the encounter boss enemy
  (`encounter.bossEnemyId`) and resolve correctly for each per-level stage boss
  (Annex Overseer / Trial Warden / Canyon Warden / Summit Warden).
- A test hook exposes the current boss-HUD model (e.g. a `bossEncounter` field
  added to the existing debug-state snapshot in `main.js`, or a
  `window.__bossEncounterModel` getter) so the wiring is observable.
- A test in `game/client/test/` exercises the wiring path: given a gameState
  with an active/locked encounter whose `bossEnemyId` matches a live enemy, the
  exposed hook / built model is populated and the `#boss-encounter-hud` element
  becomes visible; given no encounter it stays hidden.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/client/main.js`:
  - Add the import near the existing `import { syncLockOnInfoPanel } from
    './lock-on-info-panel.js';` (around line 102).
  - Resolve element refs for the `#boss-encounter-hud` nodes once (alongside the
    other HUD element lookups).
  - Call `buildBossEncounterModel({ encounter: gameState?.run?.encounter,
    enemies: gameState?.enemies, catalog: enemyDisplayCatalog })` then
    `syncBossEncounterHud(...)` from the same per-frame update site that already
    refreshes the HUD / lock-on panel each tick.
  - Expose the model via the debug snapshot (the object returned around
    lines 4505–4520 already carries `encounter`) and/or a `window.__` getter,
    matching the existing `window.__getEnemyDisplayCatalog` /
    `window.__syncLockOnInfoPanel` test-hook conventions.
- New or extended test under `game/client/test/` (jsdom project) that imports
  the module and/or drives the exposed hook with encounter + enemy fixtures.
- Reuse the module from sub-ticket 01 unchanged; do NOT duplicate model logic in
  `main.js`. No server or gameplay changes.

## Verification: code
