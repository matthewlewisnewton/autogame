## Align Gate VFX To Passage Floor Height

Passage gate meshes and unlock rings currently use the constant `FLOOR_Y`, so gates can appear slightly sunk or floating in layouts with sloped or elevated passage floors. This is visual polish only; collision remains server-authoritative.

### Acceptance Criteria
- Gate mesh positions and unlock effects sample the floor height at the passage midpoint.
- Existing flat-floor gate rendering tests still pass.
