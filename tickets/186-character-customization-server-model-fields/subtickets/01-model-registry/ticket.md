# 01 — Model Registry: define available player body models

Define the server-side registry of available player body models. Today the cosmetic profile only supports primitive shapes (`bodyShape`); this sub-ticket adds a `BODY_MODELS` constant listing the model keys and their metadata (display name, relative GLB path) that players can select.

## Acceptance Criteria
- A new `BODY_MODELS` constant is exported from `game/server/cosmetic.js` (or a new `game/server/models.js` module imported by `cosmetic.js`).
- The registry includes at least two entries:
  - `"default"` — the current placeholder (maps to the existing box geometry, no GLB required yet)
  - `"player"` — references `player.glb` in `game/client/public/models/`
- Each entry has a `key` (string), `displayName` (string), and optional `glbPath` (relative path under `client/public/models/` or `null` for primitive fallback).
- A helper function `getAvailableModelKeys()` returns an array of valid model keys (e.g., `['default', 'player']`).
- Unit tests cover: registry has at least 2 entries, `getAvailableModelKeys()` returns correct keys, and each entry has required fields.

## Technical Specs
- **New/changed file:** `game/server/cosmetic.js` — add `BODY_MODELS` map and `getAvailableModelKeys()` export
- **New test file:** `game/server/test/model_registry.test.js` — unit tests for registry structure and helper
- Keep the registry as a plain JS object/Map; no database migration needed since model selection is part of the cosmetic profile (ticket 02)

## Verification: code
