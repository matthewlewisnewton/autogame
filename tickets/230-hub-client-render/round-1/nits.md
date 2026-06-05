## Expose Rendered Hub Layout In Harness State

`window.__AUTOGAME_HARNESS_STATE__().layout` currently prefers `currentLayout`, so lobby probes can report the selected quest layout even while the renderer is showing the hub. That makes future QA captures less direct for lobby-hub tickets.

### Acceptance Criteria
- During `gamePhase === 'lobby'`, the harness state reports the active rendered hub layout profile, or includes a separate explicit `renderedLayoutProfile`.

## Silence Expected Model Loader Noise In Renderer Tests

The new client hub render test passes, but coverage logs include expected jsdom model-loader warnings for `/models/player.glb`. The warning is not a gameplay bug, but it makes real test regressions harder to spot.

### Acceptance Criteria
- Renderer tests that intentionally rely on procedural fallback avatars stub or otherwise suppress expected model-loader failures without hiding unexpected assertion failures.
