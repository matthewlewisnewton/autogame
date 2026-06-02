# Senior Review — Models: glTF Loader Infrastructure (with procedural fallback)

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block. Servers
  started; full smoke flow (auth → lobby → ready → playing → movement) captured.
- `console.log`: only two `[A/B:error] Failed to load resource ... 409 (Conflict)`
  lines — benign lobby-join race on the network layer, not a game-code page error
  or `[fatal]`. No uncaught exceptions, no module-load failures.
- Screenshots (`02-after-w.png`) show the game rendering with the EXISTING
  procedural primitives (wireframe enemy cone, player capsule, blue loot crate,
  attack cone). No visual change — exactly the fallback state this ticket targets.

The game starts and loads cleanly. Gate passes.

## Scope of this ticket's diff

`git diff a10fb6c..HEAD` touches exactly the four files the spec allows:
`game/client/models.js` (new), `game/client/renderer.js`, `game/client/vite.config.js`,
`game/client/public/models/.gitkeep` (new). No entity visuals or other files changed.

Note: eight `.glb` files + `CREDITS.md` already exist under `public/models/`, but
they were committed BEFORE this ticket's baseline (`f419b2c`/`fdbcccc`, both
ancestors of `a10fb6c`) as parked CC0 placeholder assets. They are NOT added by
this ticket and — critically — are NOT referenced, because every `MODEL_REGISTRY`
path is `null`. They are inert. The AC's intent ("renders exactly as before") is
fully met and proven by the capture, despite the literal "no .glb present" wording.

## Per-criterion findings

1. **`GLTFLoader` imported + cached async `loadModel(path)` (fetch/parse once, clone
   per caller).** ✅ `models.js` imports `GLTFLoader` from `three/examples/jsm`.
   `loadModel` caches the in-flight/resolved promise per path in `modelCache`, so a
   path is fetched at most once; each caller receives `scene.clone(true)`. The dep
   is installed (`game/client/node_modules/three/.../GLTFLoader.js` present).

2. **Static models served at `/models/<name>.glb`; committed `.gitkeep`.** ✅
   `vite.config.js` sets `publicDir: 'public'`; `public/models/.gitkeep` is tracked.

3. **Registry maps player / each enemy / each minion / loot types to OPTIONAL path.**
   ✅ `MODEL_REGISTRY` keys verified against renderer.js: enemies
   (`grunt`, `skirmisher`, `miniboss`, `spawner`), minions (`ancient_wyrm`,
   `null_crawler`, `bulkhead_mauler`), loot kinds (`currency`, `crystal`,
   `magic_stone`), plus `player`. All match the live `ENEMY_GEOMETRY`,
   `MINION_VISUAL`, and loot-`kind` strings. Every value is `null`.

4. **Player/enemy/minion/loot mesh creation consult the registry with procedural
   fallback.** ✅ `attachRegistryModel(key, host)` is called from `createPlayerAvatar`
   (`'player'`), `createEnemyMesh` (`type`), `createMinionMesh` (`minionType`), and
   both branches of `createLootMesh` (`kind`). It builds/returns the procedural mesh
   synchronously and only swaps in a model on async success (fire-and-forget). With
   null paths it early-returns — the only path exercised this ticket.

5. **With no models wired, renders exactly as before; starts/loads cleanly.** ✅
   All registry paths null → `attachRegistryModel` returns before any load. Capture
   confirms primitives unchanged.

6. **Resilient loading: missing/broken logs a warning, falls back, never throws/stalls.**
   ✅ `loadModel` guards loader construction in try/catch, routes `GLTFLoader` error
   callback to a `console.warn` + `resolve(null)`, caches the null so a bad path is
   not re-fetched, and never leaves a hung promise. `attachRegistryModel` also wraps
   the `.then` with a `.catch`. A null result leaves the procedural mesh untouched.

7. **Existing server + client unit tests still pass.** ✅ `pnpm run test:quick`:
   62 files / 1473 tests passed, 0 failures.

8. **Debug scenarios.** None added or changed by this ticket (diff is loader-only;
   `debugScenario` probe fields are unchanged from the existing harness). N/A.

Consistency with `design.md`/`requirements.md`: additive plumbing only; no
foundation regressed.

## Remaining gaps

None blocking. (See `nits.md` for minor non-blocking follow-ups.)

VERDICT: PASS
