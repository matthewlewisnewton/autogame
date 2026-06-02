# Models: glTF Loader Infrastructure (with procedural fallback)

Enable the client to load Blender-authored `.glb` models and use them in place of
the current procedural primitives — WITHOUT changing any visuals yet. When no
model file is present for an entity, it must fall back to the existing procedural
mesh exactly as today. This is the foundation later tickets build on to swap
individual entities to authored models.

## Difficulty: medium

## Goal

Add the plumbing so a later ticket can drop a `.glb` into `public/models/` plus a
registry entry and have that entity render the loaded model instead of its
primitive — with a safe fallback to the current geometry when the asset is absent.

## Acceptance Criteria

- `GLTFLoader` is imported and a cached async `loadModel(path)` helper exists
  (fetches/parses once, returns a clone per caller).
- Static models are served at `/models/<name>.glb` (vite serves `public/`), with a
  committed `game/client/public/models/.gitkeep` so the directory exists.
- A model registry maps entity keys (`player`, each enemy type, each minion type,
  loot types) to an OPTIONAL `.glb` path.
- Player mesh creation, `createEnemyMesh`, `createMinionMesh`, and loot mesh
  creation consult the registry: if a model path is set AND it loads, use the
  cloned model; otherwise use the EXISTING procedural mesh.
- With NO `.glb` files present (the state in this ticket), the game renders
  EXACTLY as before (all primitives), starts, and loads cleanly.
- Loading is resilient: a missing/broken model logs a warning and falls back to
  procedural — it never throws or stalls the render loop.
- Existing server + client unit tests still pass.

## Technical Specs

Changes limited to:
- `game/client/renderer.js` — import `GLTFLoader`; consult the registry in
  player/enemy/minion/loot mesh creation with procedural fallback.
- `game/client/models.js` — NEW small module: `loadModel(path)` cache + helper and
  the `MODEL_REGISTRY` map (all paths empty/null in this ticket).
- `game/client/vite.config.js` — ensure `public/` is served as static (`publicDir`).
- `game/client/public/models/.gitkeep` — NEW (creates the served directory).

Do NOT add any `.glb` files or change entity visuals in this ticket — the fallback
must keep the current look pixel-identical.

## Verification

`Verification: code`
