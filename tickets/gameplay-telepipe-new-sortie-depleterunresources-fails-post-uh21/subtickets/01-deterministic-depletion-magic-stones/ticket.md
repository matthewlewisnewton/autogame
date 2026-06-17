# Deploy canyon & spire telepipe-ready scenarios with depleted magic stones so depletion is deterministic

The `canyon-descent-telepipe-ready` and `spire-ascent-telepipe-ready` debug
scenarios deploy with magic stones at/near `STARTING_MAGIC_STONES` (49), forcing
the harness depletion probe to drain MS down through combat. Because weapon
swings *gain* MS and the limited hand cards exhaust to `null` first, the probe
intermittently lands on a `[telepipe, null, null, null, null, null]` hand and
hard-fails with "No usable card to deplete resources". Deploy these two
scenarios with magic stones already below `STARTING_MAGIC_STONES` (mirroring the
existing `frost-crossing-telepipe-ready` scenario), so the `msDepleted` half of
the depletion criteria is satisfied at deploy and a single greatsword swing
completes depletion deterministically before any card is exhausted.

## Acceptance Criteria

- `setupCanyonDescentTelepipeReadyExtras` and `setupSpireAscentTelepipeReadyExtras`
  in `game/server/debugScenarios.js` set `player.magicStones` to a fixed value
  strictly below `STARTING_MAGIC_STONES` (49) — use `20`, matching the existing
  `frost-crossing-telepipe-ready` scenario.
- Both functions also set a magic-stone regen grace window (e.g.
  `player._msRegenGraceUntil = Date.now() + 20000`) so passive regen cannot push
  MS back to ≥ `STARTING_MAGIC_STONES` during the depletion phase, matching the
  pattern at `debugScenarios.js:725` and `:847`.
- After both scenarios run, the deployed hand still contains the telepipe in
  slot 0 and the `magma_greatsword` weapon (`remainingCharges >= 1`) in slot 1 —
  an unconsumed usable attack card remains available for the depletion probe.
- A magic-stone weapon swing during depletion leaves `magicStones` below 49 and
  a card with `remainingCharges < charges` (the depletion probe's
  `probesMatchDepletion` is satisfiable from the deployed hand without exhausting
  it to telepipe-only).
- `game/server/test/debug-scenarios.test.js` is extended so the
  `canyon-descent-telepipe-ready` and `spire-ascent-telepipe-ready` tests assert
  `player.magicStones` is below `STARTING_MAGIC_STONES` (equals `20`) and that a
  usable non-telepipe attack card (`magma_greatsword`, `remainingCharges >= 1`)
  is present in the hand.
- Vitals-preservation behavior is unchanged: the deployed (now-depleted) magic
  stones value is the value the telepipe new-sortie flow carries through suspend
  → abandon → redeploy. No existing assertion in `debug-scenarios.test.js` that
  expected the prior MS value is left failing.

## Technical Specs

- `game/server/debugScenarios.js`:
  - In `setupCanyonDescentTelepipeReadyExtras(state, player)` and
    `setupSpireAscentTelepipeReadyExtras(state, player)` (the `afterDeploy`
    callbacks for the canyon/spire telepipe-ready scenarios), after re-seating
    the telepipe (slot 0) and `magma_greatsword` (slot 1), set
    `player.magicStones = 20` and `player._msRegenGraceUntil = Date.now() + 20000`.
  - Keep `magma_greatsword` at its full charge count (`greatswordDef.charges`,
    currently 2) so one swing yields `remainingCharges < charges` while the card
    stays in hand. Do not reduce its charges.
  - Reference the existing `frost-crossing-telepipe-ready` setup and
    `setupArenaTrialsTelepipeReadyDeploy` (`debugScenarios.js:843`) for the exact
    low-MS + regen-grace pattern. Do not touch other scenarios.
- `game/server/test/debug-scenarios.test.js`:
  - Extend the existing `canyon-descent-telepipe-ready deploys Tier 2 with
    telepipe in hand` (~line 1130) and `spire-ascent-telepipe-ready deploys Tier 2
    with telepipe in hand` (~line 1587) tests (or add focused sibling tests) to
    assert `player.magicStones === 20` (and `< STARTING_MAGIC_STONES`) plus a
    usable `magma_greatsword` with `remainingCharges >= 1`. Import
    `STARTING_MAGIC_STONES` if not already in scope.
- Do not modify `harness/validate/lib/telepipe.mjs` or any file outside `game/`;
  the fix belongs in the game-side scenario setup.

## Verification: code
