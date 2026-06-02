# Senior Review — 162: Wire enemy + minion placeholders into the registry

## Runtime health (gate)

PASS. The round-2 capture is a clean run:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block.
- `console.log`: only `[vite] connecting/connected` and `[initScene]` lines — no
  `pageerror`, no `[fatal]`, no model-load warnings from `models.js`.
- `npm test` (local re-run): **64 files, 1482 tests passed** in ~137s.

The game starts, reaches `phase: "playing"` with 5–6 enemies, and renders a
canvas. No blocking runtime issues.

## Per-criterion findings

### AC1 — Registry maps the 7 entity keys to `/models/` files
MET. `game/client/models.js` `MODEL_REGISTRY` sets exactly:
`grunt→/models/grunt.glb`, `skirmisher→…/skirmisher.glb`,
`miniboss→…/miniboss.glb`, `spawner→…/spawner.glb`,
`ancient_wyrm→…/minion-ancient-wyrm.glb`,
`null_crawler→…/minion-null-crawler.glb`,
`bulkhead_mauler→…/minion-bulkhead-mauler.glb`. All 7 files exist under
`game/client/public/models/` as valid glTF-binary v2 (200–500 KB Quaternius
CC0 monsters, ledgered in `CREDITS.md`). Verified by `models.test.js`.

### AC2 — Scaled to primitive footprint + grounded (feet at entity y)
MET. `renderer.js` adds `getRegistryModelTarget(key)` (derives target height +
local footY from `ENEMY_GEOMETRY`/`MINION_VISUAL`) and `normalizeRegistryModel`
(uniform-scales the loaded scene to the target height, then aligns bbox min.y to
the foot plane). The math is consistent with the procedural primitives:
- enemies (no host scale): cone/octahedron height maps 1:1, footY = −height/2 (or −radius).
- minions: targets are deliberately **host-local** (commit 04 removed the
  `minion.scale` multiply) because the model is added as a child of the host
  mesh that already carries `scale.setScalar(visual.scale)`. Net world size is
  applied exactly once. Checked: `ancient_wyrm` 1.5×1.5 = 2.25 world height,
  `null_crawler` r0.35→0.7, `bulkhead_mauler` h1.2. Covered by
  `renderer-normalization.test.js` (incl. a scaled-host world-bbox assertion).

### AC3 — Player NOT changed
MET. `MODEL_REGISTRY.player` stays `null`; `player.glb` is present but parked per
`CREDITS.md`. `attachRegistryModel('player', …)` early-returns on the null path,
so the hero stays procedural for the customization epic.

### AC4 — Failed model falls back to procedural; game starts/loads cleanly
MET. `attachRegistryModel` is fire-and-forget: a null/absent path is a no-op, a
null `loadModel` result or a rejection leaves the procedural mesh visible and
only warns — it never throws or removes the host. `models.test.js` exercises
both the null-resolve and reject branches against `createEnemyMesh`, and asserts
the procedural geometry/material survive. Clean console confirms no load failures.

### AC5 — Tests pass; capture shows new meshes
MET for enemies. Tests are green. In the gameplay screenshots (`02-after-w.png`,
`03-after-d.png`) the old solid procedural cones are **absent** — the swap path
hides procedural materials and attaches the GLB, and what remains are the
loaded models plus pre-existing attack-telegraph VFX (the red wireframe cylinders
are the radial-windup hitbox viz from `renderer.js:1959`, the orange fans are
cone telegraphs — both unrelated to this ticket). The disappearance of the
procedural cones is positive evidence the model swap executed.

Minions were not summoned in this deterministic smoke capture (`minions: []` in
the probe; the `Vault Wyrm` card was never played), so minion meshes were not
visually exercised. Their code path is identical to enemies and is unit-tested,
so this is a capture-coverage nit, not a functional gap (see `nits.md`).

## Design / regression consistency

Consistent with the additive loader infra from 161. No server changes; the
swap is purely client-visual and degrades to the prior procedural rendering on
any failure, so the foundation in `requirements.md` is not regressed. No debug
scenarios were added or changed by this ticket.

## Remaining gaps

None blocking. One non-blocking nit (minion visual coverage in capture) recorded
in `nits.md`.

VERDICT: PASS
