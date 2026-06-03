## Mention resolveFloorY in sloped-movement design docs

`game/docs/design.md` (and `game/docs/gameplay-review.md`) still describe server player Y snapping only via `sampleFloorY()`, without the new `resolveFloorY()` fallback used at all production call sites. Updating those sentences would keep docs aligned with `game/shared/floorSampling.esm.js` and prevent future agents from reintroducing inline `??` or `Number.isFinite` ternaries.

### Acceptance Criteria

- `game/docs/design.md` Floor Geometry section notes that concrete walkable Y uses `resolveFloorY(sampleFloorY(…))` on server and client.
- `game/docs/gameplay-review.md` ramp-height bullet references `resolveFloorY` alongside `sampleFloorY` where Y is applied to entities or meshes.
