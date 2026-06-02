# Camera follow and plateau vista

Ensure the follow camera tracks player height on plateau, ramps, and canyon floor, and that the plateau rim does not hide the canyon when standing at the default spawn facing the descent.

## Acceptance Criteria

- While moving across sunken-canyon plateau, ramps, and canyon floor, the camera target Y tracks the player avatar Y (sampled floor height) without sustained clipping below the visible floor mesh.
- From the default plateau spawn pose, a downward sight line toward the canyon center is unobstructed by dungeon wall colliders (plateau rim wall height ≤ player eye line or uses a low parapet).
- No new regression in default (non-stage) dungeons.
- Automated test(s) assert camera target Y uses player Y on a sloped sunken-canyon fixture, and a server/layout test asserts no full-height wall blocks the spawn→canyon center segment at rim height.

## Technical Specs

- **`game/client/renderer.js`** (or wherever the follow camera is updated): confirm `camera.position.y` / look-at incorporates `player.y` from state; adjust follow offset or near-plane only if sunken-canyon playtests show floor clipping.
- **`game/client/dungeon.js`**: if plateau rim walls are too tall, lower rim segment `length` or split walls so the canyon side stays below ~1.5 units at the vista edge (coordinate with layout in **`game/server/dungeon.js`** if the fix is generator-side).
- **`game/client/test/`** or **`game/server/test/dungeon.test.js`**: add regression tests for camera Y tracking fixture and rim line-of-sight (segment vs wall AABBs).

## Verification: code
