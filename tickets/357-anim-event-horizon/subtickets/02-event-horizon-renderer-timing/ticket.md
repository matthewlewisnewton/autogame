# Event Horizon — renderer integration, pull→crush timing & tests

Wire the reworked singularity primitive into `renderEventHorizon`, stage the
pull-then-crush beat to match the server's instant two-phase resolution, and lock
behavior down with client tests. Depends on sub-ticket 01
(`spawnEventHorizonEffect`).

## Acceptance Criteria

- `event_horizon` remains registered in `CARD_RENDERERS` mapping to
  `renderEventHorizon` (registration line intact).
- `renderEventHorizon` replaces the current Gravity-Well-like mix
  (`spawnTelegraphRing` + `spawnParticleBurst` + `spawnSummonEffect`) with
  `ctx.spawnEventHorizonEffect(origin, data.radius, data.centerRadius, …)` at
  cast time (t = 0).
- **Timing sync:** `event_horizon` has no positive `windUpMs` (instant cast).
  Pull VFX fires synchronously when `CARD_USED` is handled. Center **crush**
  impact (e.g. `spawnImpactDecal` and/or a tight inner ring burst at
  `data.centerRadius`) is deferred via `ctx.scheduleAfter` by a named constant
  `EVENT_HORIZON_CRUSH_DELAY_MS` (~300–450 ms) so the visual reads pull → crush
  matching `applyEventHorizon` (pull then `collectRadialHits` crush in
  `game/server/simulation.js`). No projectile-travel delay is introduced.
- Optional ctx helpers (`spawnImpactDecal`, `spawnParticleBurst`) are guarded;
  renderer does not throw when absent.
- Per-hit enemy feedback: when `data.hits` / `data.crushed` entries exist, spawn
  hit sparks/bursts at enemy mesh positions (same pattern as `renderInfernoPillar`).
- Visually distinct from `renderGravityWell`: tests assert Event Horizon does **not**
  call the same primitive mix as Gravity Well (no bare `spawnTelegraphRing` at
  outer radius without `spawnEventHorizonEffect`; Gravity Well still lacks inner
  crush ring).
- `data.radius === undefined` guard preserved (no VFX when radius absent).
- `pnpm test:quick` passes; extended `cardRenderers.test.js` coverage for
  `event_horizon` including crush `scheduleAfter` delay, synchronous pull spawn,
  palette, radii (`12` / `2.5`), windUpMs absence, and optional-helper safety.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Rewrite `renderEventHorizon` (~L669–683) and its color constants
    (`EVENT_HORIZON_COLOR`, `EVENT_HORIZON_EMISSIVE`).
  - Define `EVENT_HORIZON_CRUSH_DELAY_MS` (named constant in this file or
    `config.js`).
  - Call `ctx.spawnEventHorizonEffect` immediately; schedule crush-phase
    `spawnImpactDecal` / inner burst via `ctx.scheduleAfter`.
  - Keep `event_horizon: renderEventHorizon` registration (~L1644).
- `game/client/main.js` — import `spawnEventHorizonEffect` from `renderer.js`
  and pass it on the renderer ctx deps object (mirror `spawnDivineGraceEffect`).
- `game/client/socketHandlers/cardHandlers.js` and
  `game/client/socketHandlers/socketHandlerCtx.js` — expose
  `spawnEventHorizonEffect` on the card render ctx bundle.
- `game/client/test/cardRenderers.test.js`:
  - Add `spawnEventHorizonEffect` to `makeCtx` record helpers.
  - Replace/update existing `event_horizon` tests (~L1572–1611) for the new
    primitive mix, crush scheduling, distinctness vs `gravity_well`, and
    windUpMs assertion.
- Do **not** change `spawnEventHorizonEffect` internals (owned by sub-ticket 01),
  server code, or other cards' renderers.

Payload reference (`game/server/cardEffects.js` ~L876): `{ origin, radius,
centerRadius, pulled, crushed, hits }`.

## Verification: code
