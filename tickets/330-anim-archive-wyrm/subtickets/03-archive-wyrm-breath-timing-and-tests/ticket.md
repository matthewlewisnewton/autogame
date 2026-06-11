# Archive Wyrm breath timing sync and test coverage

Align Archive Wyrm's client animation timing with the server minion breath
resolution: a channeled `fire_breath` over `breathDurationMs` (2500 ms) with
damage ticks every `breathTickMs` (500 ms). The breath-start `cardUsed` payload
spawns the sustained cone; subsequent `breathPhase: 'tick'` payloads carry only
hit feedback. Schedule mid-channel visual pulses on the start event so the
channel reads continuously between server ticks. Document that this creature card
has no `windUpMs` (no 307/315 charge telegraph on deploy).

## Acceptance Criteria

- A shared constant `ARCHIVE_WYRM_BREATH_TICK_MS` (value **500**) is defined in
  `game/client/config.js` and imported by `cardRenderers.js`; derived constants
  `ARCHIVE_WYRM_BREATH_DURATION_MS` (**2500**) and
  `ARCHIVE_WYRM_BREATH_TICK_COUNT` (**4**, the number of follow-up tick
  intervals within one channel) are exported alongside it.
- `renderArchiveWyrmBreath` on `breathPhase === 'start'` sets
  `spawnAttackEffect` `duration` to `data.breathDurationMs ??
  ARCHIVE_WYRM_BREATH_DURATION_MS` (2500 ms) — matching server
  `queueWyrmBreathCardUsed`.
- On breath start, `scheduleAfter(ARCHIVE_WYRM_BREATH_TICK_MS * n, …)` fires
  **4** mid-channel pulse callbacks (`n = 1..4`) that each spawn a lightweight
  `spawnTelegraphRing` and/or `spawnParticleBurst` along the breath axis (no
  second full cone mesh). Tick-phase `cardUsed` events still only emit hit
  sparks (no duplicate cones).
- `breathPhase === 'tick'` produces **zero** `spawnAttackEffect` calls and
  **zero** `scheduleAfter` calls (only immediate hit primitives).
- Airborne origins: all scheduled pulse positions respect `origin.y` and
  tilted `direction.y` the same way the existing airborne breath test does.
- Tests in `game/client/test/cardRenderers.test.js`:
  - Breath start with `{ breathPhase: 'start', breathDurationMs: 2500 }` asserts
    cone `duration: 2500` and exactly **4** `scheduleAfter` delays of
    `[500, 1000, 1500, 2000]`.
  - Breath tick payload asserts zero `spawnAttackEffect` and zero
    `scheduleAfter` calls.
  - `getCardDef('ancient_wyrm')` documents server contract:
    `breathDurationMs === 2500`, `breathTickMs === 500`, `breathRange === 10`,
    `breathConeAngle` resolves to `Math.PI / 3`, and `windUpMs` is absent or
    ≤ 0 (no charge telegraph expected).
  - Existing airborne breath Y-position test still passes against
    `renderArchiveWyrmBreath`.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions in `updateAttackEffects`.

## Technical Specs

- `game/client/config.js`:
  - Export `ARCHIVE_WYRM_BREATH_TICK_MS = 500`,
    `ARCHIVE_WYRM_BREATH_DURATION_MS = 2500`,
    `ARCHIVE_WYRM_BREATH_TICK_COUNT = 4`.
- `game/client/cardRenderers.js`:
  - Import the constants from `./config.js`.
  - In `renderArchiveWyrmBreath`, wrap mid-channel pulses in a loop
    `for (let n = 1; n <= ARCHIVE_WYRM_BREATH_TICK_COUNT; n++) {
      ctx.scheduleAfter(ARCHIVE_WYRM_BREATH_TICK_MS * n, () => { … }); }`
    inside the breath-start branch only.
  - Read `breathDurationMs` from `data.breathDurationMs` with config fallback;
    do not add client-side wind-up delay (creature deploy has no `windUpMs`).
  - Pulse callbacks should reuse `originOf` / `directionOf` / `pointAlong` from
    the enclosing closure; avoid per-tick allocations beyond existing primitive
    pools.
- `game/client/test/cardRenderers.test.js`:
  - Add a dedicated `describe('ancient_wyrm')` timing block (or extend the
    existing Archive Wyrm group) with the assertions above.
  - Import timing constants from `../config.js` in tests to prevent drift.
- Do not change server simulation or `CARD_USED` payload shape; timing constants
  mirror `game/shared/cardStats.json` `ancient_wyrm` and
  `game/server/simulation.js` `updateWyrmMinionAI` defaults.

## Verification: code
