# Boss-encounter HUD module, DOM scaffold, and styles

Add the rendering layer for an on-screen stage-boss encounter UI: a pure model
builder plus a DOM sync function, the HTML scaffold it drives, and its CSS. This
sub-ticket builds and unit-tests the component in isolation; wiring it into the
live render loop is done in sub-ticket 02.

## Acceptance Criteria

- A new module `game/client/boss-encounter-hud.js` exports a pure function
  `buildBossEncounterModel({ encounter, enemies, catalog })` that:
  - returns `null` when `encounter` is null/undefined, when the encounter phase
    is not `active` AND `encounter.locked` is not true, when no enemy matches
    `encounter.bossEnemyId`, or when the matched boss enemy has `hp <= 0`.
  - otherwise returns an object containing the boss display `name`, current and
    max HP, an `hpPct` (0–100, clamped), and an HP-bar tier class.
  - resolves the boss display name from `catalog` (the variant name when the
    enemy has a `variant` present in `catalog.variants`, otherwise the type
    name from `catalog.types[enemy.type].name`); falls back to a non-empty
    generic label (e.g. "Boss") if the catalog lacks the entry.
  - reuses `getHpBarTier` from `game/client/vanguard-hud.js` for the tier class.
- The module also exports `syncBossEncounterHud(model, els)` that, given the
  model and an element refs object, shows the container and updates the boss
  name text and the HP-fill width (% of max) and tier class when `model` is
  truthy, and hides the container (adds `hidden` class + `aria-hidden="true"`)
  when `model` is `null`.
- `game/client/index.html` contains a `#boss-encounter-hud` container (initially
  `hidden`, `aria-hidden="true"`) with child elements for an encounter banner
  label, the boss name, and an HP bar background + fill (e.g.
  `#boss-encounter-name`, `#boss-encounter-hp-fill`).
- `game/client/style.css` contains styling rules for `#boss-encounter-hud` and
  its children so the bar renders as a horizontal boss health bar.
- A new test file `game/client/test/boss-encounter-hud.test.js` covers:
  `buildBossEncounterModel` returning null for each null case (no encounter,
  dormant/unlocked, missing boss, dead boss) and a populated model for an
  active and a locked encounter; correct name resolution for a stage boss
  (e.g. `annex_overseer` → "Annex Overseer") using the real catalog from
  `server/enemyDisplay.js`; and `syncBossEncounterHud` showing/hiding the DOM.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- New file `game/client/boss-encounter-hud.js`. Model the structure on the
  existing `game/client/lock-on-info-panel.js` (pure `build*Model` + `sync*`
  pair, jsdom-friendly). Import `getHpBarTier` from `./vanguard-hud.js`.
  - `buildBossEncounterModel`: find `boss = enemies.find(e => e.id ===
    encounter.bossEnemyId)`; gate on `encounter.phase === 'active' ||
    encounter.locked === true` (use the phase string the server emits — confirm
    against `server/encounters.js` `ENCOUNTER_PHASES`, value `active`); compute
    `hpPct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)))`.
  - `syncBossEncounterHud(model, els)`: follow `syncLockOnInfoPanel`'s
    show/hide pattern (toggle `hidden` class + `aria-hidden`).
- `game/client/index.html`: insert the `#boss-encounter-hud` block near the
  existing `#lock-on-info-panel` / `#objective-hud` HUD elements (around
  lines 62–71).
- `game/client/style.css`: add rules alongside the existing HUD/lock-on styles.
- New test `game/client/test/boss-encounter-hud.test.js`: mirror
  `game/client/test/lock-on-info-panel.test.js` (uses `createRequire` to load
  `../../server/enemyDisplay.js` `buildEnemyDisplayCatalog`, builds DOM nodes,
  runs under the jsdom vitest project). Boss enemy fixtures use real type ids
  (`annex_overseer`, etc.) with `id`, `hp`, `maxHp`, `type`.
- Do NOT change server code or `main.js` in this sub-ticket.

## Verification: code
