## Preserve Vertical Aim On Lingering Dragon Breath Ticks

`dragons_breath` now applies its initial locked-on cone hit with vertical aim, but the spawned lingering area effect still stores only `dirX`/`dirZ`. This is non-blocking because the ticket's height-hit requirement is satisfied, but preserving `originY`/`dirY` through `spawnDragonsBreathEffect` and `updateAreaEffects` would make the follow-up DOT ticks match the initial tilted breath.

### Acceptance Criteria
- Locked-on `dragons_breath` area effects store and reuse the same vertical aim components for subsequent DOT ticks.
- Existing flat-ground dragon breath behavior remains unchanged.
