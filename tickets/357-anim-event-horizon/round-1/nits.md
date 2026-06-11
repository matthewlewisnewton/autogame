## Align Event Horizon per-hit sparks with the crush beat
In `renderEventHorizon` (game/client/cardRenderers.js) the central crush impact
(decal + telegraph ring + burst) is deferred by `EVENT_HORIZON_CRUSH_DELAY_MS`
(375 ms) to read as a pull→crush beat, but the per-enemy hit sparks/bursts are
spawned synchronously at cast. The two crush visuals therefore land ~375 ms
apart. It is defensible (sparks mark the instant damage was actually applied),
but moving the per-hit sparks inside the same `scheduleAfter` callback would make
the crush moment read as a single coherent beat.

### Acceptance Criteria
- Event Horizon's per-hit enemy sparks/bursts and the central crush impact fire
  on the same beat (either both deferred by `EVENT_HORIZON_CRUSH_DELAY_MS` or a
  deliberate, documented stagger).
- Existing event_horizon client tests still pass (update timing assertions if the
  sparks move into the scheduled callback).
