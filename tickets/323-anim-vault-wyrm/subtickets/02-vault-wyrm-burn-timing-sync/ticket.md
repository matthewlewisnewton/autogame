# Vault Wyrm — burn DoT visual & breath-tick timing sync

Make the Vault Wyrm (`dungeon_drake`) breath animation's TIMING line up with
the server effect: the breath cone duration matches the server breath window,
the per-tick server breath events produce visible ember/burn pulses, and the
lingering burn DoT it applies to enemies is visualized in sync with the
server burn. Builds on sub-ticket 01's fire/ember palette.

## Acceptance Criteria
- On breath start (`breathPhase` is `'start'`, i.e. not `'tick'`), the cone
  `spawnAttackEffect` `duration` equals the server-provided
  `data.breathDurationMs` (the Vault Wyrm channels for `breathDurationMs`,
  2000ms in `game/shared/cardStats.json`), so the visible cone persists for
  the whole server breath window rather than a default flash.
- On each server-driven breath tick (`breathPhase === 'tick'`), the renderer
  emits a burn/ember pulse on every currently-hit enemy (using the hit enemy
  mesh positions from `data.hits` + `ctx.enemyMeshes()`), in the warm
  fire/ember palette — visualizing the recurring burn ticks. Ticks still do
  NOT redraw the full cone (no duplicate `spawnAttackEffect` on tick).
- The per-hit burn visualization is keyed to the server burn DoT: the burst
  count/spread or a scheduled ember reflects the burn being (re)applied each
  tick, not a one-off at start. No client-side timer invents its own cadence —
  visuals are driven by the server `start`/`tick` events that already arrive
  at the server breath cadence.
- The Vault Wyrm summon respects its `windUpMs` (600ms in `cardStats.json`):
  the existing 307/315 charge wind-up telegraph still plays during the summon
  wind-up (confirm it is not regressed); the breath visuals begin only with
  the server breath events, not before.
- No perf regression: no unbounded particle growth across repeated ticks; no
  new per-frame allocations beyond the existing per-event bursts.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert: (a)
  start-cone `duration === breathDurationMs`; (b) a `'tick'` phase event emits
  per-hit ember/burn bursts at enemy positions while emitting no
  `spawnAttackEffect`. Full client + server vitest suites pass.

## Technical Specs
- `game/client/cardRenderers.js` — in `renderWyrmAttack`: keep the
  start-phase cone `duration` bound to `data.breathDurationMs`; on
  `breathPhase === 'tick'`, in addition to the existing hit sparks, emit a
  warm ember `spawnParticleBurst` (and/or `spawnHitSpark`) per hit enemy so
  each server burn tick is visible. Reuse the fire/ember palette established
  in sub-ticket 01. Do not introduce a client-side interval/`scheduleAfter`
  loop — the server already pushes `start` + `tick` breath events at the
  `breathTickMs` cadence (see `applyWyrmBreathTick` /
  `queueWyrmBreathCardUsed` in `game/server/simulation.js`).
- `game/client/test/cardRenderers.test.js` — extend the existing Vault Wyrm
  breath tests (start + tick) to cover the duration sync and the per-tick
  ember bursts; assert tick phase emits no `spawnAttackEffect`.
- Touch ONLY the Vault Wyrm render fn and its tests; do not change server
  simulation, the Archive Wyrm renderers, or other cards.

## Verification: code
