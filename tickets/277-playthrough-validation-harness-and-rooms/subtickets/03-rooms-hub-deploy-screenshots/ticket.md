# Rooms hub → character → deploy with hub/entry screenshots

Extend the playthrough driver to complete the ship-hub onboarding path (register/login already in 02), create or load a character, deploy into Training Caverns (Rooms) via the `training-caverns-tier-2` debug scenario, and capture the first two validation screenshots.

## Acceptance Criteria

- After auth, the driver creates a solo lobby and waits for squad lobby phase with the **ship hub** rendered: `__AUTOGAME_HARNESS_STATE__().layout.profile === 'hub'`, `hasCanvas === true`, and `phase === 'lobby'`.
- The driver exercises **character create/load**: open the character booth (`?booth=character` on initial navigation or `window.openCharacterBooth()`), click **Save character** with the default appearance (free save — no paid cosmetic change), and confirm the booth closes without error.
- Screenshot `validation/rooms/01-hub.png` is written while in the hub lobby (before deploy).
- From the lobby, the driver invokes `window.__requestDebugScenarioForTest('training-caverns-tier-2')` and asserts `{ ok: true }`. This is the sanctioned shortcut documented in `game/server/debugScenarios.js` (equivalent to unlocking Tier II and deploying the stage-boss encounter).
- The driver waits until `phase === 'playing'`, `cardHandVisible === true`, and `objective.type === 'stage_boss'` (confirms Training Caverns Tier II stage-boss run, not Tier I `defeat_enemies`).
- Screenshot `validation/rooms/02-level-entry.png` is written immediately after entering the dungeon.
- Harness state after deploy shows at least one `annex_overseer` in `enemyHp` and `encounter.phase === 'dormant'` (requires sub-ticket 01 hooks).
- Driver `--steps hub` (or `deploy`) runs this slice end-to-end and exits `0`; failures print harness-state JSON.

## Technical Specs

- `harness/validate/playthrough.mjs`: implement hub + character + deploy steps for the `rooms` preset; wire `--steps hub` (or `deploy`).
- `harness/validate/lib/screenshot.mjs` (or inline helper): `capture(page, outDir, name)` → PNG under `validation/rooms/`.
- `harness/validate/presets/rooms.mjs`: confirm `deployScenario: 'training-caverns-tier-2'`, `bossType: 'annex_overseer'`, `questId: 'training_caverns'`, `questTier: 2`.
- Use `window.__launchReadyUpForTest()` only if a code path needs manual ready-up; prefer the `training-caverns-tier-2` scenario which calls `enterPlayingPhase` server-side.
- Depends on sub-tickets **01** (encounter harness fields) and **02** (driver skeleton).
- No new `game/` gameplay changes unless character-booth save requires a missing test hook (prefer existing `openCharacterBooth` / DOM `#character-booth-save-btn`).

## Verification: code
