# Probe boss health-bar / encounter UI and distinct boss visuals (283, 284)

Extend the spire-ascent validation driver so the boss-active phase records the
stage-boss encounter HUD state (health bar, boss name, HP fraction — ticket 283)
and the `spire_warden` distinct-visual descriptor (ticket 284), capturing a
dedicated screenshot. No gameplay code changes — driver instrumentation only.

## Acceptance Criteria

- A new probe runs during the spire boss-active phase and records a `bossUi`
  section into `run-summary.json` containing: encounter HUD container visible,
  boss display name (must resolve to the Summit Warden / `spire_warden` entry,
  NOT a generic fallback or another level's boss), `hp`, `maxHp`, and `hpPct`
  (0–100), and the encounter `phase`/`locked` flags.
- The probe asserts the boss HUD is visible with `hpPct` between 1 and 100 while
  the encounter is active, and fails the run (not silently) if the HUD model is
  null/hidden during an active locked encounter.
- A `bossVisuals` field records the `spire_warden` visual descriptor read from
  live state (boss enemy `type`/`variant` and the resolved catalog name) so the
  diff shows the boss is distinct from `grunt`/`skirmisher`/other-level bosses.
- A new screenshot `05a-boss-healthbar.png` is captured during the active phase
  and listed in `run-summary.json`.
- The probe is gated behind a preset flag so other presets (hub, rooms, etc.)
  are unaffected.

## Technical Specs

- `harness/validate/presets/spire-ascent.mjs` — add a probe-config flag (e.g.
  `probeBossUi: true`) consumed by the driver.
- `harness/validate/lib/bossUiProbe.mjs` (new) — export an async probe that reads
  `window.__AUTOGAME_HARNESS_STATE__().bossEncounter` (the boss-encounter-hud
  model: `name`, `hp`, `maxHp`, `hpPct`, `tier`) plus `encounter`
  (`phase`/`locked`) and the live boss enemy from `enemyHp` (for type/variant),
  asserts the criteria above, and returns the `bossUi`/`bossVisuals` objects.
  Reuse `readHarness` from `harness/validate/lib/harnessState.mjs` and
  `writeScreenshot` from `harness/validate/lib/screenshot.mjs`.
- `harness/validate/playthrough.mjs` — in the spire boss-active phase (after
  `activeProbe` is built, around the `bossEncounter` section), call the new probe
  when the preset flag is set and fold its result + screenshot path into the
  `run-summary.json` `bossEncounter`/top-level output.
- If the boss `type`/`variant` is not already present in the harness-state
  `enemyHp` entries, expose it read-only there in
  `game/client/main.js` `__AUTOGAME_HARNESS_STATE__()` (additive validation
  instrumentation only — no gameplay behavior change).

## Verification: code
