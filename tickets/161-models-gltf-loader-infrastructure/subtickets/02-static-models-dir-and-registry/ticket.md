# Static `/models/` serving and empty model registry

Ensure Vite serves authored `.glb` files from `public/models/` and define the entity→path registry with every entry unset so later tickets can drop in assets without further schema work.

## Acceptance Criteria

- `game/client/public/models/.gitkeep` is committed so the served directory is tracked in git.
- `game/client/vite.config.js` explicitly sets `publicDir: 'public'` (Vite default, but make it intentional for harness review).
- Files placed at `game/client/public/models/foo.glb` are reachable at `/models/foo.glb` in dev.
- `MODEL_REGISTRY` in `game/client/models.js` maps these keys to `null` (no path): `player`, `grunt`, `skirmisher`, `miniboss`, `spawner`, `ancient_wyrm`, `null_crawler`, `bulkhead_mauler`, `currency`, `crystal`, `magic_stone`.
- A small exported helper (e.g. `getRegistryModelPath(key)`) returns the registry value or `null` for unknown keys.
- No `.glb` files are added in this sub-ticket.

## Technical Specs

- **Create** `game/client/public/models/.gitkeep` (empty file; `CREDITS.md` may already live alongside it — keep that file untouched).
- **Edit** `game/client/vite.config.js` — add top-level `publicDir: 'public'` alongside existing `server` config.
- **Edit** `game/client/models.js` — add and export `MODEL_REGISTRY` object and `getRegistryModelPath(key)`; registry paths are all `null` for this ticket.

## Verification: code
