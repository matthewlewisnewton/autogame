# Server: phase-step-ready scenario must not fabricate a co-op ally

The `phase-step-ready` debug scenario currently injects a synthetic ally object
directly into `state.players`, letting QA exercise the Phase Step swap without a
real second connected lobby player. Rework the scenario so it only equips and
positions the local caster, leaving the real co-op-ally requirement to genuine
two-player gameplay (and to the existing `phase_step` server test for swap logic).

## Acceptance Criteria

- The `phase-step-ready` branch in `setupDebugScenario` (server `index.js`) no
  longer creates or inserts any synthetic player into `state.players`. After the
  scenario runs, `state.players` contains only the genuinely connected players —
  it does NOT contain any object whose id begins with `phase-step-ally-` or whose
  username is the fabricated `'Ally'`.
- The scenario still leaves the caster in a usable Phase Step state: caster `hp`
  restored, magic stones set, `equippedKeyItemId === 'phase_step'`, and
  `keyItemCooldownUntil === 0`, so a real second player who joins and stands in
  range can be swapped with.
- `phase-step-ready` remains a registered/allowed debug scenario (it stays in the
  scenario allow-set near the top of `index.js`); only its body changes. No other
  debug scenario branch is modified.
- The swap logic itself is unchanged — the `useKeyItem` `phase_step` handler and
  `game/server/test/phase_step.test.js` are not modified by this sub-ticket, and
  `pnpm test` (server) still passes with no regressions.

## Technical Specs

- `game/server/index.js`, the `else if (name === 'phase-step-ready') { ... }`
  branch (~line 814):
  - Keep the caster setup lines: `player.hp = MAX_HP;`,
    `player.magicStones = MAX_MAGIC_STONES;`,
    `player.equippedKeyItemId = 'phase_step';`,
    `player.keyItemCooldownUntil = 0;` and the `state.enemies = []` clear.
  - DELETE the entire synthetic-ally block: the `allyId` / `allyX` / `allyZ` /
    `allyFloorY` locals and the `state.players[allyId] = { ... }` assignment
    (~lines 824–864). Update the leading comment so it describes equipping and
    positioning only the local caster and notes that a real second player is
    required for an actual swap.
- Do not change the scenario allow-set entry `'phase-step-ready'` (~line 417),
  the `useKeyItem` handler, `progression.js`, or any test file.

## Verification: code
