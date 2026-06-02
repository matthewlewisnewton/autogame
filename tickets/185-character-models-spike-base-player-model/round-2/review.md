# Senior review — 185 character-models spike: base player model

Top-level `ticket.md` is absent from this worktree (noted in `decompose.txt`); I
judged the ticket against the three sub-ticket acceptance-criteria sets
(01 contract docs, 02 normalized `player.glb`, 03 proportion morph targets),
which together define the deliverable, plus `game/docs/MODEL_SPIKE.md` as the
canonical contract.

## Runtime health (captured run)

- `round-2/metrics.json`: `"ok": true`, `pageerrors: []`, `capturePlanSource:
  "fallback"` (deterministic full-flow smoke). Probes show `phase: "playing"`,
  `sceneInitialized: true`, `hasCanvas: true`, `connectionState: "connected"`,
  players moving (x/z change between probes), HP 100→94 from combat.
- `round-2/console.log`: only `[vite] connecting/connected` and two
  `409 (Conflict)` resource lines — benign lobby-name collision during the
  deterministic smoke capture; both clients then connected and entered
  gameplay (confirmed by probes). No `pageerror`, no `[fatal]`, no game-code
  exception. `pageerrors.json` is `[]`.

The game starts and loads cleanly. This is a docs+asset spike with **no runtime
wiring** (renderer/registry untouched), so the smoke run only needs to prove the
game still boots — it does.

## Per-criterion findings

### 01 — Research + model contract
- `game/docs/SPIKE_DECISION.md` ✅ — compares Quaternius Universal Base
  Characters (CC0, ~13k tris) vs Kenney Mini Characters (CC0) vs authored
  Blender; picks Quaternius, records license, tri count, and rationale.
- `game/docs/MODEL_SPIKE.md` ✅ — documents the six canonical, case-sensitive
  keys verbatim (`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`,
  `shoulderWidth`), the conventions (path, feet `y=0`, −Z forward, 1.8u height,
  `PLAYER_RADIUS=0.5`), and the influence range `0.0 / 0.5 neutral / 1.0` with
  the runtime mapping `(p−0.5)×2` for ticket 186/187.
- `game/client/public/models/README.md` ✅ — author-facing summary, transform
  rules, head-anchor section, links to MODEL_SPIKE / SPIKE_DECISION / CREDITS.

### 02 — Normalized `player.glb`
- File is tracked, valid glTF 2.0 binary (magic `glTF`, version 2). ✅
- Independent AABB check: height **1.8196** (≈1.8 ✅), feet min Y **−0.01**
  (≈0 ✅), XZ symmetric & origin-centred ✅.
- `CREDITS.md` row updated — Quaternius "Universal Base Characters — Superhero
  Male FullBody", CC0, URL, `Status: spike` (no longer `parked`). ✅
- Head anchor documented in README: bone `Head` at `(0, 1.592, 0)` with a
  fallback offset; 65-joint skin with a `Head` joint confirmed present in the
  committed glb. ✅
- ⚠️ **XZ footprint deviation (non-blocking).** The body fits the 0.5-radius
  cylinder at every Y band (waist/torso/legs half-X 0.18–0.20, Z-extent
  ≤0.29), but the mesh is a **T-pose** whose outstretched arms reach half-X
  **0.93** at shoulder height (y≈1.3–1.5). The README claims "max XZ
  half-extent 0.5", which is literally inaccurate. I treat this as a nit, not a
  blocker: (a) collision is a fixed 0.5 cylinder regardless of mesh, with no
  runtime wiring yet; (b) MODEL_SPIKE.md explicitly scopes the rule to
  "waist/shoulders … not a full AABB", and those regions fit; (c) T-pose limb
  overhang is standard for a rigged base mesh (arms come down once posed/
  animated in ticket 187). Captured as a nit for 187 to pose-down + a doc fix.

### 03 — Proportion morph targets
- The committed glb carries **exactly** the six canonical morph names
  (case-sensitive) on all three mesh primitives (`Face`, `Face.001`,
  `Sphere.005_Retopology.004`); `found.size === 6` with no aliases. ✅
- Independent buffer read confirms every morph has **non-zero, region-targeted**
  POSITION deltas on the body mesh (max |Δ|): height 0.235, armLength 0.117,
  shoulderWidth 0.100, legLength 0.098, headSize 0.042, torsoWidth 0.027 — each
  hitting a distinct vertex region (1.2k–6.5k verts). No collapse / no inverted
  geometry (deltas are small displacements). Runtime maps influence 0→1 to
  weight −1→+1, doubling the visible range. ✅ (torsoWidth/headSize are the
  subtlest — noted as a nit, still distinct and non-degenerate.)
- MODEL_SPIKE.md states neutral `0.5`, min `0.0`, max `1.0` for all keys, plus
  authoring regions and the re-bake command. ✅
- Automated check `game/client/test/playerModelMorphs.test.js` ✅ — asserts all
  six names present, exactly six, and six POSITION targets per morphed
  primitive. Ran it: **3/3 pass**. It is matched by the root `vitest.config.js`
  `client` project include (`client/test/**/*.{test,spec}.{js,mjs}`), so it is
  picked up by `pnpm test:quick`. ✅
- Normalization from 02 preserved (height/feet checks above) ✅; no renderer or
  registry changes ✅.

## Design / regression consistency
- No game runtime code changed (`git diff` is docs, the glb, a bake script, and
  one test). No regression to `requirements.md` foundation; consistent with the
  character-customization direction in `design.md`. The smoke run proves the
  existing game loop is unaffected.

## Debug scenarios
- None added/changed by this ticket (`debugScenario: null` in probes). N/A.

## Remaining gaps
None blocking. The asset, docs, morph contract, and test all satisfy the
sub-ticket acceptance criteria, and the game boots cleanly with the change
applied. The T-pose arm-span vs README "0.5 half-extent" wording and the very
subtle torsoWidth/headSize morphs are recorded in `nits.md` for later cleanup.

VERDICT: PASS
