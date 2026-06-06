# 03-distinct-boss-models

Fix the glTF model registry so each stage boss loads a visually distinct model. Currently `annex_overseer` and `spire_warden` both share `miniboss.glb` (making them look identical to `miniboss`/Vault Warden when glTF loads), and `arena_champion` references a non-existent `arena-champion.glb` (falls back to procedural cone).

Create distinct low-poly glTF models for each boss type, or assign unique procedural fallbacks when a distinct model is not feasible. The goal: when glTF models load, each boss still looks different from the others.

## Acceptance Criteria

- `MODEL_REGISTRY.arena_champion` points to an existing `.glb` file in `game/client/public/models/` (or is set to `null` to use the distinct procedural cone as fallback)
- Each of the four stage bosses (`miniboss`, `annex_overseer`, `arena_champion`, `spire_warden`) maps to a distinct visual — either a unique `.glb` file OR a `null` registry entry that falls back to the distinct procedural geometry from `ENEMY_GEOMETRY`
- If a new `.glb` is created for `arena_champion`, it must exist at `game/client/public/models/arena-champion.glb` and be a valid glTF binary file
- Setting `annex_overseer` and `spire_warden` to `null` is acceptable (their distinct procedural geometry from sub-tickets 01/02 provides sufficient visual identity)
- Tests pass (`pnpm test`)

## Technical Specs

- **File:** `game/client/models.js` — `MODEL_REGISTRY` (lines ~21-34)
- **Optional new file:** `game/client/public/models/arena-champion.glb` (a simple low-poly cone/diamond glTF matching the gold theme)
- Two valid approaches:
  1. Set `annex_overseer`, `spire_warden`, and `arena_champion` to `null` — relies on distinct procedural geometry (colors + emissive + scale from sub-tickets 01/02) as the visual identity
  2. Create a minimal `arena-champion.glb` and keep `annex_overseer`/`spire_warden` on distinct models or `null`
- Approach (1) is preferred for speed: the procedural geometry IS the visual identity, and the distinct colors/emissive/scale from sub-tickets 01/02 already make each boss unique

## Verification: code
