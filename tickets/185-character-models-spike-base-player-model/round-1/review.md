# Senior review — 185 character-models spike (base player model)

## Runtime health (gate)

The captured run is clean:

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block,
  `capturePlanSource: "fallback"` (deterministic full-flow smoke). Probes show
  `phase: "playing"`, scene initialized, canvas present, latency 1ms, players
  reach gameplay and move (x/z change between probes).
- `console.log`: only `[vite] connecting/connected`, `[initScene] Initializing
  Three.js scene...`, and a `409 (Conflict)` on a resource fetch. The 409 is a
  benign session/lobby resource race present in normal runs — not a `pageerror`
  or `[fatal]`, and the renderer is **not touched** by this ticket so it cannot
  be a regression from this work.

This is a docs + asset spike: nothing is wired into `renderer.js` or the model
registry, so a clean run primarily confirms **no regression** to the running
game. Confirmed via `git diff` that `renderer.js`, `models.js`, and `game/server/`
are untouched.

## Top-level acceptance criteria (Beads autogame-0yf)

> One base humanoid .glb committed under game/client/public/models with documented
> license; morph targets/shape keys defined for the proportion dimensions; short
> decision note (source vs authored, license, poly budget, anchor/scale conventions).

**All met.** Broken down against the three sub-tickets:

### 1. Research + model contract (sub-ticket 01)

- `game/docs/SPIKE_DECISION.md`: compares four candidate sources (Quaternius UBC,
  custom Blender, Kenney, Sketchfab), selects Quaternius UBC (CC0), states ~13k
  tris / ≤20k budget, and gives rationale. ✔
- `game/docs/MODEL_SPIKE.md`: defines the six canonical case-sensitive keys
  (`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`),
  the consumer list (server/glTF/client), morph range `0.0 / 0.5 / 1.0`, and the
  full conventions table (path, feet y=0, −Z forward, 1.8u, PLAYER_RADIUS 0.5,
  facing `rotation.y = playerRotation − π/2`). ✔
- `game/client/public/models/README.md`: author-facing summary linking
  MODEL_SPIKE, SPIKE_DECISION, CREDITS. ✔
- No `.glb` added in 01, no `tickets/**` writes. ✔

### 2. Commit normalized `player.glb` (sub-ticket 02)

Independently inspected the binary:

- Valid glTF 2.0 (`glTF` magic, version 2, 1.64 MB), tracked in git. ✔
- POSITION bbox: `min.y ≈ 3.6e-7`, `max.y = 1.80000` → **feet at y=0, height ≈1.8**. ✔
- `Head` bone present in node list (skin joints include `Head`, `neck_01`) →
  satisfies the README head-anchor convention for ticket 190. ✔
- `CREDITS.md` row for `player.glb` updated: real source (Quaternius UBC —
  Superhero Male FullBody), CC0, URL, `Status: spike` (no longer parked). ✔
- No renderer/registry wiring. ✔

Footprint note: the full T-pose AABB (x ∈ [−0.56, 0.88], z ∈ [−1.11, 0.14])
exceeds the 0.5-radius cylinder, but `MODEL_SPIKE.md` explicitly documents that
the radius is measured at the mid-torso slice and that T-pose arms/feet are
expected to poke past it. Consistent with the documented contract; not wired
into collision yet. ✔

### 3. Proportion morph targets (sub-ticket 03)

Independently decoded the morph-target accessors from the BIN chunk:

- `extras.targetNames` = exactly `["height","headSize","torsoWidth","armLength",
  "legLength","shoulderWidth"]` — six, case-exact, no aliases. ✔
- Each morph has non-zero deltas and no two morphs are byte-identical (verified by
  pairwise comparison) → distinct, visible silhouette changes. ✔
- Extremes do not collapse or invert: the 1.0 silhouette is the neutral mesh with a
  modest single-axis scale (1.10–1.22×); the 0.0 base is a compounded ~0.46×
  shrink (positive scale, non-degenerate). ✔
- `MODEL_SPIKE.md` documents neutral `0.5` and min/max `0.0/1.0`. ✔
- `game/client/test/playerModelMorphs.test.js` loads the GLB and asserts the six
  names; collected by `vitest.config.js` (`client/test/**`) and so by `test:quick`.
  `coverage.log` shows it passing. ✔
- Normalization preserved (feet y=0, −Z, ~1.8u as measured above). ✔
- No renderer/registry/server-cosmetic changes. ✔

## Consistency with design / foundation

No `game/docs/design.md` regression: this ticket only adds docs, an asset, dev-only
Blender/Node authoring scripts, a test, and a `.gitignore` entry for `.authoring`.
Runtime code paths are untouched, so the foundation in `requirements.md` is intact.
No debug scenarios were added (`debugScenario` remains null in probes).

## Code quality

Authoring scripts are dev-only and gitignored inputs; the Node normalizer and the
two Blender scripts are clear and documented. The test reads the GLB JSON chunk
directly (no Three.js mock) — appropriate and fast.

## Remaining gaps

None blocking. One quality concern is recorded as a nit (morph non-orthogonality —
the committed base is the combined-min and each key's delta also un-shrinks the
other axes, so the documented "0.5 = neutral per key" does not reproduce the
original Quaternius rest mesh, and driving one slider perturbs the others). This is
acceptable for an editable spike asset — ticket 187 owns the avatar wiring where
real morph isolation will matter — and it does not violate any stated acceptance
criterion. See `nits.md`.

VERDICT: PASS
