# Senior review — 185-character-models-spike-base-player-model

## Runtime health (capture proof)

`round-1/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`.
The captured run reached `phase: "playing"` with two connected players, scene
initialized, canvas present, latency 0–1 ms, players moving (W/D) and taking
damage (HP 100→94). `console.log` shows only `[vite] connected` and a benign
`409 (Conflict)` on a resource load (concurrent same-browser auth — pre-existing
harness noise, not from this ticket's files). `server.log`/`client.log` show only
THREE.Clock deprecation + a `ws proxy ECONNRESET` on socket close — all benign.
**The game starts and loads cleanly.**

This is a spike: it commits an asset + contract docs + a test, and explicitly
does **not** wire the model into runtime. Confirmed `MODEL_REGISTRY.player` is
still `null` (`game/client/models.js:24`) and no runtime files
(`renderer.js`, `models.js`, `simulation.js`, cosmetic validation) were modified
(`git diff --name-only` baseline→HEAD). The committed 11 MB `player.glb` is
therefore not loaded at runtime — procedural avatars still render, which is why
the game behaves exactly as before. Correct for this spike.

## Acceptance criteria (top-level beads autogame-0yf)

The top-level AC: *"One base humanoid .glb committed under game/client
public/models with documented license; morph targets/shape keys defined for the
proportion dimensions; short decision note (source vs authored, license, poly
budget, anchor/scale conventions) written."*

### 1. Base humanoid `.glb` committed with documented license — MET
- `game/client/public/models/player.glb` is git-tracked and is a valid glTF 2.0
  binary (independently verified: magic `glTF`, version 2, declared length ==
  file length 11,216,556 bytes). Loadable.
- Normalized per `MODEL_SPIKE.md`: bounding-box height **1.820** (≈1.8 ✓), feet
  at y≈**-0.010** (≈0 ✓). Skinned mesh with armature and a `Head` bone present
  (hat anchor for ticket 190). ~**13,334** triangles (matches documented ~13 k
  budget).
- License: `CREDITS.md` row for `player.glb` = Quaternius Universal Base
  Characters (Superhero Male), **CC0**, URL, `Status: spike`. Conforms to the
  redistributable-license policy.
- T-pose arm span X≈1.86 m exceeds the 0.5-radius cylinder, but that is the
  arms, not the collision footprint; documented as expected overhang in
  `README.md`. Collision is mid-torso only.

### 2. Morph targets for the six proportion dimensions — MET
- The GLB carries **exactly** the six canonical names on every primitive of both
  meshes (`Face.001`, `Sphere.005_Retopology.004`): `height`, `headSize`,
  `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` — independently
  verified from the JSON chunk; no aliases, count == 6.
- Deltas are non-zero and distinct on the body mesh (max |Δ|): height 0.127,
  shoulderWidth 0.116, legLength 0.093, armLength 0.058, torsoWidth 0.026,
  headSize 0.023 — several cm on a 1.8 m model, i.e. visible, distinct silhouette
  changes per key. The eyes mesh sensibly responds only to height/headSize.
- Automated check `game/client/test/playerModelMorphs.test.js` asserts presence,
  exact set, and per-primitive target count. It is collected by the existing
  vitest config (`client/test/**`) used by `pnpm test:quick`; ran green in the
  harness (`coverage.log`, 2 passed) and I re-ran it green directly (2 passed).

### 3. Decision note (source vs authored, license, poly budget, conventions) — MET
- `game/docs/SPIKE_DECISION.md`: compares 4 candidate sources (Quaternius,
  custom Blender, Kenney, Sketchfab), states the final choice, CC0 license,
  ~13 k triangle budget, and rationale.
- `game/docs/MODEL_SPIKE.md`: canonical contract — the six exact proportion keys,
  the 0.0/0.5/1.0 min/neutral/max influence range and the `(v−0.5)×2` client
  mapping for ticket 187, world orientation/scale (feet y=0, −Z forward, 1.8 u,
  PLAYER_RADIUS 0.5), head-anchor section, and rig/object names.
- `game/client/public/models/README.md`: author-facing summary linking the three
  docs + CREDITS, with the head-anchor bone (`Head` ≈ (0,1.59,0)) for ticket 190.
- Note: the AC literally says "written to the ticket dir," but the decomposer
  deliberately placed the canonical docs under `game/docs/` to keep implementers
  inside `game/**` and avoid the prior-round `tickets/**` scope violations. This
  is a reasonable, in-repo-canonical location and satisfies the intent. Not a gap.

## Consistency / regression
- Consistent with the character-customization direction; nothing in `game/docs`
  is contradicted. No foundation regression: the diff only **adds** files (docs,
  two dev-only authoring scripts, the test, the GLB, `@gltf-transform` devDeps,
  lockfile). No runtime path changed; captured run confirms unchanged gameplay.
- No debug scenarios were added by this ticket (no runtime code touched); the
  `debugScenario` fields in the probe are pre-existing harness instrumentation.

## Code quality
- The morph-authoring (`add-player-proportion-morphs.mjs`) and normalizer
  (`normalize-player-glb.mjs`) are dev-only helpers under `client/scripts/`, not
  imported by runtime or tests. No obvious dead/broken code in the shipped paths.
- No console/page errors attributable to the ticket.

## Remaining gaps
None blocking. One minor doc inconsistency captured in `nits.md` (SPIKE_DECISION
"final choice" still names *Regular Male* while the committed/credited asset is
*Superhero Male*, since Regular is paid-tier — README/CREDITS are already
correct). Does not affect any acceptance criterion.

VERDICT: PASS
