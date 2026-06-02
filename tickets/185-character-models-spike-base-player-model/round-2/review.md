# Senior review — 185 character-models-spike-base-player-model (round 2)

## Runtime health (gate)

The captured run is clean:
- `metrics.json`: `"ok": true`, `phase: "playing"`, scene initialized, 2 players,
  5–6 enemies, HP/MS/movement all advancing between probes (player x/z and HP
  change 100→94 across probes — real gameplay, not a frozen frame).
- `pageerrors`: `[]` — no browser code defects.
- `console.log`: only `[vite] connecting/connected`, two `409 Conflict`
  resource lines (benign lobby create/join race), and `[initScene]` logs. No
  `pageerror` / `[fatal]`.
- `client.log`: only benign `ws proxy EPIPE` on socket close.
- No `harness_failure` block.

Screenshots `01-initial` (lobby) and `02-after-w` (in-run, top-down arena)
confirm the game renders and is playable. The player avatar is still the
procedural blue box + orange cone — expected, since this ticket does NOT wire
`player.glb` into the renderer (renderer wiring is deferred to ticket 187, as
the docs explicitly state). Game runs. Gate passes.

## Acceptance criteria

The top-level AC (bead `autogame-0yf`) has three parts.

### AC1 — one base humanoid `.glb` under `game/client/public/models` with documented license
**Met.** `game/client/public/models/player.glb` is committed (16 MB) and is a
valid glTF: 3 skinned meshes (`Face`, `Face.001`,
`Sphere.005_Retopology.004`), a single 65-joint skin. Independently inspected
via `@gltf-transform/core`. License is documented in three places and is clean:
- `CREDITS.md` row: Quaternius "Universal Base Characters" — Superhero Male,
  **CC0**, with source URL and `Status` = "spike base — normalized, not wired in
  renderer (187)".
- `MODEL_SPIKE.md` and `spike-decision.md` both record CC0 1.0.

The docs are honest about a tier nuance: the committed mesh is
`Superhero_Male_FullBody` from the free **Standard** (CC0) zip, whereas
sub-ticket 01 originally targeted "Regular Male" from the paid **Source** kit.
Same pack/rig; the mismatch is documented, and the committed asset is
unambiguously CC0 — no licensing risk.

### AC2 — morph targets / shape keys for the proportion dimensions
**Met.** Six named morph targets are bound on **every** primitive of **all
three** meshes, with `mesh.extras.targetNames` =
`[height, headSize, torsoWidth, armLength, legLength, shoulderWidth]`
(verified directly on the binary). The contract test
`game/client/test/playerModel.glb.test.js` (3 tests) passes locally — it
checks the exact six names, six targets per primitive each with a non-null
`POSITION`, and normalized bounds. `coverage.log` shows the same suite green.

The morph deltas are authored procedurally by
`game/scripts/add-player-morph-targets.mjs` (idempotent, re-runnable, with a
base-bounds assertion guarding the normalization). Region/weight logic is
plausible (smoothstep-banded by body region; face meshes carry only `headSize`).

### AC3 — short decision note (source vs authored, license, poly budget, anchor/scale)
**Met.** `game/tickets/185-character-models-spike-base-player-model/spike-decision.md`
is a ≤1-screen note covering all four required dimensions: source vs authored,
license, poly budget, and anchor/scale conventions. The fuller canonical
contract lives in `game/docs/MODEL_SPIKE.md` and the verbatim code rules in
`game/client/public/models/README.md`.

Note on location: the AC literally says "written to the ticket dir", but the
round-1 SCOPE-CONFLICT re-decompose (`decompose.txt`) deliberately moved the
note under `game/tickets/.../` because implementers are scoped to `game/**` and
repo-root `tickets/` writes get reverted by `scope_audit`. This is the
documented, intended resolution from the re-decomposition — the required
content exists and is discoverable. I treat AC3 as satisfied.

Measured-vs-documented spot checks (all consistent):
- Bounds: feet `min.y = 0.000`, height `1.800`, footprint half-extents X=0.500 /
  Z=0.078 → ≤ `PLAYER_RADIUS = 0.5`. Matches docs exactly.
- Poly: ~8,483 verts / 14,318 tris. Within the documented "8k–14k triangle"
  budget (marginally over the 14,000 ceiling; see nits).

## Design / requirements consistency

Consistent. This is an asset+docs spike that adds no runtime code paths — the
renderer is untouched and still draws the procedural avatar, so there is no
gameplay regression (captured run confirms). The proportion key contract is
self-consistent across the script, the test, README, and MODEL_SPIKE, which
sets up tickets 186/187/188 cleanly. New deps (`@gltf-transform/*`) are
correctly placed in `devDependencies` (build-time tooling only).

No debug scenarios were added or changed by this ticket.

## Remaining gaps

None blocking. The acceptance criteria are fully and robustly met and the
captured run is healthy. A few non-blocking nits are recorded in `nits.md`
(notably a stray placeholder value in `pnpm-workspace.yaml` and the heavy
embedded textures that should be trimmed before the renderer loads the asset in
187).

VERDICT: PASS
