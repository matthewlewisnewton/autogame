# Frost Crossing telepipe vitals-preservation regression test (+ fix if real)

Add a server-side regression test that drives the **frost_crossing / ice-cavern**
level through a telepipe suspend → hub return → redeploy cycle and asserts that
player vitals (HP + Magic Stones) persist, exactly mirroring the proven
fire/training-caverns coverage. This is the authoritative check of whether the
ICE-playthrough `telepipeVitalsPreserved` FAIL (ticket 372) is a **real bug** or
a **validation artifact**. If the test exposes a genuine ice-level persistence
regression, fix it in `game/server`.

## Background / what we know

- Fresh-deploy vitals carry-forward in `checkAllReady` (`game/server/progression.js`,
  ~line 3697-3724) reads `player.hp` / `player.magicStones` and reapplies them
  on redeploy — this path is **level-independent**, so HP/MS persistence should
  not differ between ice and fire unless an ice-specific code path mutates them.
- An existing integration test ("two-player telepipe extract preserves damage and
  spent magic stones across hub return and redeploy", `integration.test.js`
  ~line 5531) proves this for the default quest. There is **no** equivalent test
  pinned to `frost_crossing`, and **no** ice validation preset/findings exist.
- The `frost-crossing-tier-1` debug scenario (`game/server/debugScenarios.js`
  ~line 1237) deploys the ice-cavern layout and is the way to put a test run on
  the ice level.

## Acceptance Criteria

- A new server test exercises the ice level (`frost_crossing` / ice-cavern layout)
  through: deploy → damage player so HP < MAX_HP → spend Magic Stones so MS <
  starting → place telepipe → all active players extract → run returns to the hub
  lobby → redeploy.
- The test asserts the player's `hp` after redeploy **equals** the pre-suspend HP
  (exact match, not full-heal), and `magicStones` after redeploy is **preserved**
  (>= pre-suspend MS, allowing only passive regen, never reset to starting/full).
- The test confirms the run actually lands on the ice level (e.g. asserts the
  selected quest / layout corresponds to `frost_crossing` / ice-cavern band) so it
  cannot silently pass on the default quest.
- The test passes under `pnpm test` (from `game/`). If it initially fails because
  of a real ice-specific persistence bug, the underlying `game/server` cause is
  fixed (not the assertion weakened) and the test then passes.
- No regression in the existing telepipe / vitals tests.

## Technical Specs

- **`game/server/test/integration.test.js`** — add the new test. Reuse the existing
  helpers: `connectAndJoinLobby`, `runSimulationInPrimaryLobby`, `damagePlayer`,
  `tryEnterTelepipe`, `testGameState`, and the `debugScenario` socket emit with
  `{ name: 'frost-crossing-tier-1' }` (see `game/server/debugScenarios.js:1237`) to
  pin the run to the ice-cavern layout. Model the suspend→redeploy flow on the
  existing test at ~line 5531 ("preserves damage and spent magic stones across hub
  return and redeploy").
- **`game/server/progression.js`** and/or **`game/server/debugScenarios.js`** —
  edit ONLY if the test surfaces a genuine ice-level persistence regression
  (e.g. an ice-specific deploy/spawn path overwriting `player.hp`/`player.magicStones`).
  Keep the fix minimal and aligned with the level-independent carry-forward already
  in `checkAllReady`.
- Do NOT add a Playwright preset or touch `harness/` — server test + (conditional)
  server fix only.

## Verification: code
