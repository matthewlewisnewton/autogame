# Senior Review — Models: glTF Loader Infrastructure (with procedural fallback)

## Runtime health (gate)

The captured run is healthy:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
- `console.log`: only `[vite] connecting/connected`, two `[initScene] Initializing
  Three.js scene...` lines, and one `409 (Conflict)` on a resource load. The 409 is
  the benign lobby create/join race between the two harness players (player B joining
  a session player A is creating), not a game-code page error or fatal. No `pageerror`
  or `[fatal]` lines.
- Probes show both players reach `phase: "playing"`, scene initialized, canvas present,
  5–6 enemies spawned, HP/movement updating across probes.
- Screenshot `02-after-w.png` shows the unchanged procedural look: blue box player, red
  cylinder enemies, orange cone attack indicator. Visuals are pixel-consistent with the
  pre-ticket primitives.

## Per-criterion findings

**1. `GLTFLoader` imported + cached async `loadModel(path)` (fetch/parse once, clone per caller)** — MET.
`game/client/models.js` imports `GLTFLoader` from `three/addons`. `loadModel` keeps a
module-level `templateCache` (Map of path → Promise), so each path is fetched/parsed
once; every call resolves the shared template and returns `template.clone(true)`. Unit
test `caches the template and returns independent clones` confirms `load` is called once
across two `loadModel` calls and the two clones are distinct, deep clones.

**2. Static models served at `/models/<name>.glb`; committed `.gitkeep`** — MET.
`game/client/vite.config.js` sets `publicDir: 'public'`. `game/client/public/models/.gitkeep`
is committed (in the diff). (Note: real `.glb` files already exist in that directory — they
predate this ticket, added in commit `fdbcccc` which is an ancestor of the baseline
`ce7f511`. This ticket did not add them, so the "do not add `.glb`" constraint is not
violated; they are simply unreferenced because the registry is all-null.)

**3. Model registry maps entity keys to OPTIONAL `.glb` path** — MET.
`MODEL_REGISTRY` covers `player`, all four enemy types (`grunt`, `skirmisher`, `miniboss`,
`spawner`), all three minion types (`ancient_wyrm`, `null_crawler`, `bulkhead_mauler`),
and loot types (`currency`, `crystal`, `magic_stone`). Verified these keys match the
`ENEMY_GEOMETRY` and `MINION_VISUAL` keys and the loot call sites. All paths are `null`.
`getRegistryModelPath` safely returns `null` for unknown keys.

**4. Player/enemy/minion/loot mesh creation consult the registry with procedural fallback** — MET.
`createPlayerMesh`, `createEnemyMesh`, `createMinionMesh`, and `createLootMesh` build the
existing procedural mesh first, then call `attachRegistryModel(key, mesh)`. That helper
no-ops when the registry path is `null`; when a path exists, it async-loads and swaps the
glTF in as a child of the procedural placeholder (preserving the Object3D held in the mesh
maps). This is a sound design — references in `playersMeshes`/enemy/minion/loot maps stay
stable across the async swap.

**5. With no `.glb` wired, renders EXACTLY as before; starts and loads cleanly** — MET.
All registry paths are `null`, so `attachRegistryModel` returns immediately and no model
is ever loaded or swapped. Capture + screenshot confirm pure procedural rendering, clean
start, gameplay reachable.

**6. Resilient loading: missing/broken model warns + falls back, never throws/stalls** — MET.
`fetchTemplate` wraps `loader.load` in both an async `onError` callback (warns, resolves
`null`) and a synchronous `try/catch` (warns, resolves `null`), so the Promise never
rejects. `loadModel` returns `null` for a null template; `attachRegistryModel` skips the
swap when the model is `null`, leaving the procedural mesh in place. A `_disposed` flag set
in `disposeOne` guards against swapping a model onto an entity that despawned mid-load.
Unit test `warns and resolves to null on load failure without rejecting` confirms.

**7. Existing server + client unit tests still pass** — MET.
Ran the project's configured suite: client `463 passed (24 files)`, server `986 passed
(37 files)`. The `createEnemyMesh` refactor into `buildProceduralEnemyMesh` + wrapper
preserves the exported signature/output; `enemyMeshHalfHeight` and renderer tests pass.

## Design / regression check

Consistent with `game/docs/design.md`; pure additive infrastructure with no visual or
gameplay change. No debug scenarios added. No regression to the foundation.

## Remaining gaps

None blocking. One minor non-blocking observation captured in `nits.md` (group-placeholder
child disposal when models are eventually wired).

VERDICT: PASS