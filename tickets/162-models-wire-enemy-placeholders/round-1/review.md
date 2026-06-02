# Senior Review — 162 Models: Wire enemy + minion placeholders into the registry

## Runtime health (capture)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`, no `failure_kind`.
- `console.log`: clean — only `[vite] connected` and `[initScene] Initializing Three.js scene...`. No `pageerror`/`[fatal]` lines.
- Probes show the game reaching `phase: "playing"` with 5–6 live enemies, canvas present, scene initialized.

The game starts and loads cleanly. This is **not** a runtime-health failure.

## Per-criterion findings

### AC1 — Registry maps the 7 entity keys to `/models/` files
**Met.** `game/client/models.js` `MODEL_REGISTRY` now maps `grunt`, `skirmisher`,
`miniboss`, `spawner` → `/models/<key>.glb`, and `ancient_wyrm`, `null_crawler`,
`bulkhead_mauler` → `/models/minion-*.glb`. All 8 `.glb` files exist under
`game/client/public/models/`. Unit test `modelPathFor` asserts every mapping.

### AC2 — Each model scaled to ~primitive footprint and grounded
**NOT met for `ancient_wyrm`.** `normalizeRegistryModel` (renderer.js:289) scales the
model to `getRegistryModelTarget` height and aligns its bbox-min to the procedural
foot plane — correct for the 4 enemies and for `null_crawler`/`bulkhead_mauler`
(host scale = 1).

But `createMinionMesh` applies `mesh.scale.setScalar(1.5)` to the host **before**
`attachRegistryModel` (renderer.js:371-374), and `attachRegistryModel` parents the
model under that host (`host.add(model)`, renderer.js:338). The model therefore
inherits the host's 1.5× scale. Because `getRegistryModelTarget` also multiplies the
minion branch by `scale` (renderer.js:270-277), the `ancient_wyrm` model is sized to
local height 2.25 and then multiplied **again** by 1.5 → world height ~3.375 (vs.
procedural 2.25), and its foot drops to ~y=-1.19 vs. the procedural foot at ~y=-0.63.
Result: the ancient_wyrm model renders ~50% oversized and sunk into the floor.

This violates the ticket's explicit core requirement ("scaled to approximately match …
and sits on the ground"). Only `ancient_wyrm` is affected (it is the lone minion with a
non-1 `scale`). It was not exercised in the capture (the probe shows `minions: []`), so
it was not caught visually.

### AC3 — Player NOT changed
**Met.** `MODEL_REGISTRY.player` stays `null`; `player.glb` exists on disk but is never
referenced. `attachRegistryModel('player', …)` short-circuits on the null path.

### AC4 — Missing/failed model falls back to procedural; game still loads cleanly
**Met.** `attachRegistryModel` is fire-and-forget: null result keeps procedural and only
warns; rejection is caught and never throws/removes the host. Unit tests cover both
"resolves null" and "rejects" paths, asserting the procedural mesh stays visible and no
`modelOverride` is set. Capture confirms a clean load.

### AC5 — Existing tests pass; capture shows new meshes
**Partially met.** `client/test/models.test.js` passes (6/6, re-run locally). The capture
shows enemies rendering and the game running with no page errors, satisfying the enemy
side. Minion models were not present in the captured run, so the minion meshes (and the
ancient_wyrm defect) were not visually verified.

## Consistency / regression

No regression to the procedural foundation: fallback is intact and the player is
untouched. Loot keys remain `null`. The change is additive and consistent with the
161 loader infrastructure.

## Remaining gaps

1. **`ancient_wyrm` minion model is double-scaled (~1.5×) and sunk into the floor.**
   The model is parented under the host mesh that already has `scale 1.5`, while
   `getRegistryModelTarget` also folds `scale` into the target height/footY. The two
   compound. This breaks AC2 (scale + grounding) for that entity.

(No other blocking gaps. Coverage of `normalizeRegistryModel`/`getRegistryModelTarget`
is a nit — see nits.md.)

VERDICT: FAIL
