# 01 — Vault dais arena landmark

Add a crowded-profile boss arena landmark (`vault_dais`) so Initiate Vault Tier 2 has a dedicated, deterministic miniboss pedestal distinct from the open-plaza `arena_dais`.

## Acceptance Criteria

- Rigid `crowded` layouts (`layoutMode: 'rigid'`, used by `training_caverns` Tier 2) include exactly one `vault_dais` entry in `layout.landmarks` at a deterministic position in a non-start combat room, clear of cover footprints and doorway gaps.
- `vault_dais` has a defined server footprint in `LANDMARK_FOOTPRINTS`; placement is stable across seeds (same seed → same `{ x, z, type, yaw }`).
- Default (non-rigid) crowded layouts are unchanged — they still use existing decorative types (`reactor_coil` / `pipe_stack`) only.
- Client `buildLandmarkMesh('vault_dais', …)` renders a composed mesh (hex platform + reactor accent) using crowded profile materials; landmarks remain visual-only (no collision).
- Vitest in `game/server/test/dungeon.test.js` and `game/client/test/dungeon.test.js` asserts rigid crowded landmark type, count, placement rules, and client mesh group emission.

## Technical Specs

- **`game/server/dungeon.js`**
  - Add `vault_dais` to `LANDMARK_FOOTPRINTS` (≈2.4×2.4 footprint, similar clearance to `arena_dais`).
  - Add `placeVaultDaisRigid(layout)` (or equivalent) that picks the last sorted combat/treasure host room and places one centered/interior `vault_dais` landmark; invoke from `decorateCrowdedLayout` when `layoutMode === 'rigid'` instead of `placeLandmarksOrdered` for the boss pedestal (decorative `reactor_coil` optional — do not block boss placement).
  - Export nothing new unless tests need helpers.
- **`game/client/dungeon.js`**
  - Extend `buildLandmarkMesh` with a `vault_dais` case: stacked hex/cylinder platform with emissive reactor accent, visually distinct from circular `arena_dais`.
  - Existing `buildDungeon` landmark loop should pick it up automatically.
- **`game/server/test/dungeon.test.js`** — rigid crowded landmark assertions (type, count, host room role, determinism).
- **`game/client/test/dungeon.test.js`** — `buildLandmarkMesh('vault_dais')` and `buildDungeon` group count for a rigid crowded fixture layout.

## Verification: code
