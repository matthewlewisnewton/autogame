# Citadel Sovereign enemy definition and drop tables

Add the `citadel_sovereign` capstone boss to `ENEMY_DEFS` as the hardest-hitting
boss in the game, wire its model/drop config, and reconcile the existing
"riftbound colossus is supreme" assertions that would otherwise break. This is
pure server data + tests; the quest that spawns it lands in sub-ticket 02.

## Acceptance Criteria

- `ENEMY_DEFS.citadel_sovereign` exists in `game/server/simulation.js` with:
  - `name: 'Citadel Sovereign'`, a description identifying it as the citadel
    capstone tyrant, and `surfacedStats` listing `hp`, `attackDamage`,
    `attackStyle`, `attackRange`, `burnDurationMs`.
  - `hp: 460` EXACTLY — the recorded 180s `defeatBoss` validation ceiling
    (design.md: 500 HP was unachievable; 460 is the known-good cap). It ties
    `riftbound_colossus` at the ceiling; it must NOT exceed 460.
  - `attackDamage: 30` — strictly greater than the `attackDamage` of every
    other entry in `ENEMY_DEFS` (riftbound_colossus is currently top at 28).
  - `attackStyle: 'radial'`, `attackRange: 6`, `attackWindupMs: 1200`,
    `chaseSpeed: 1.15`, `wanderSpeed: 0.5`, `burnDurationMs: 3500` (its radial
    shockwave ignites players, like riftbound_colossus but longer).
- `game/server/config.js`: `ENEMY_MODELS.citadel_sovereign = 'dungeon_drake'`
  (same card drop as all other stage bosses) and
  `ENEMY_MS_DROPS.citadel_sovereign = 90` (new highest MS drop in the table).
- `game/server/test/riftbound_colossus.test.js` is updated: the
  "drops the highest magic stone value in the table" assertion (currently
  `value < 80` for every other entry) now exempts `citadel_sovereign` and
  instead asserts the sovereign's 90 tops the table; the
  "strictly out-stats every other stage-boss band def" test is reworded/scoped
  to non-capstone bosses (its explicit type list must not gain
  `citadel_sovereign`).
- `game/server/test/enemy_display_catalog.test.js`: `ENEMY_TYPES` list gains
  `citadel_sovereign` (the catalog auto-derives from `ENEMY_DEFS`, so the
  equality assertion fails otherwise) and the suite passes.
- New `game/server/test/citadel_sovereign.test.js` (mirror the structure of
  `riftbound_colossus.test.js`) covering: def registration + surfaced stats;
  `hp === 460` and `hp <= 460` ceiling; `attackDamage` strictly greater than
  every other `ENEMY_DEFS` entry (iterate the whole table); a resolved radial
  hit damages the player AND sets burning (`burningUntil` in the future);
  model and MS-drop config entries exist with the values above.
- `game/docs/design.md` Stage Bosses section: add a `citadel_sovereign`
  (Citadel Sovereign) row at 460 HP, and amend the `riftbound_colossus`
  paragraph so it no longer claims sole supremacy — the Citadel Sovereign now
  ties the 460 HP ceiling and carries the strictly highest `attackDamage`.
- The full server test suite (`pnpm test:quick` from `game/`) passes — no
  other enumeration test regresses.

## Technical Specs

- `game/server/simulation.js`: insert the def directly after
  `riftbound_colossus` (~line 1225) following the same comment style; reuse the
  existing radial + `burnDurationMs` attack plumbing (no new attack code —
  riftbound_colossus already exercises radial+burn).
- `game/server/config.js`: extend `ENEMY_MODELS` (~line 73 block) and
  `ENEMY_MS_DROPS` (~line 92 block).
- `game/server/test/riftbound_colossus.test.js`: lines ~102–126 hold the two
  supremacy assertions to scope down; keep them otherwise intact.
- `game/server/test/enemy_display_catalog.test.js`: ~line 19 `ENEMY_TYPES`.
- `game/server/test/citadel_sovereign.test.js`: new file; copy the harness
  helpers (enemy spawn + windup resolution) from `riftbound_colossus.test.js`.
- `game/docs/design.md`: Stage Bosses table + the riftbound paragraph below it.
- Do NOT touch `quests.js`, `debugScenarios.js`, or any client file in this
  sub-ticket.

## Verification: code
