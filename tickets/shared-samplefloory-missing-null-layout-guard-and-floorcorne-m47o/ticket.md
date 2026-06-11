# Shared: sampleFloorY missing null-layout guard and floorCorners fallback (crashes client prediction AND server tick)

## Difficulty: easy

## Goal

In game/shared/floorSampling.esm.js, sampleFloorSurface starts with if (!layout) return normal, but sampleFloorY dereferences layout.platforms/layout.rooms directly — TypeError on null layout (current callers like renderer.js:6282 guard it, but server and movementPrediction paths rely on convention). Inside the platform branch, platform.floorCorners.yNW is read unguarded while the room branch carefully falls back to DEFAULT_FLOOR_Y per corner. A layout with an untagged platform crashes both client prediction and the server tick. Fix: add the !layout guard and the same fc ? fc.yNW : DEFAULT_FLOOR_Y fallback for platforms. Note: the .js twin is a runtime bridge that evals the .esm.js source, so only the esm file needs the change. Found in code review 2026-06-09.

## Acceptance Criteria

- sampleFloorY returns DEFAULT_FLOOR_Y for null layout and for platforms missing floorCorners; unit tests cover both edge cases

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
