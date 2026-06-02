# Senior review — 185-character-models-spike-base-player-model (round 1)

## Runtime health (captured run)

PASS. `round-1/metrics.json` reports `"ok": true`, `"pageerrors": []`, and no
`harness_failure` block. `console.log` is clean: only Vite connect lines and two
`initScene` logs. The only `[error]` line is `Failed to load resource: 409
(Conflict)` during auth — this is pre-existing harness/session behaviour, **not**
introduced here: the diff touches no server or client runtime code (only a
dormant `.glb`, docs, tests, dev-only build scripts, and devDependencies). The
probes confirm a fully playable session (`phase: "playing"`, combat, movement,
HP 100→94, enemies spawning). No game-code page error or fatal.

This is a research/authoring **spike**. The asset is intentionally not rendered
yet — `game/client/models.js` keeps `player: null`, and runtime wiring is
explicitly deferred to ticket 187.

## Acceptance criteria

The top-level `ticket.md` is not in the worktree; criteria taken from beads
`autogame-0yf`:

### AC1 — One base humanoid `.glb` under `public/models` with documented license
**Met.** `game/client/public/models/player.glb` is committed and well-formed
(glTF 2.0 binary, version 2, length matches file size). It is a single skinned
humanoid: body `Sphere.005_Retopology.004` (12,566 tris) + `Face`/`Face.001`,
total ~14.3k tris — consistent with the SPIKE_DECISION ~13k estimate. A `Head`
rig node exists for hat attachment (ticket 190). License is recorded in
`CREDITS.md`: Quaternius "Universal Base Characters — Superhero Male", **CC0**,
with source URL and `spike` status. Policy (CC0/CC-BY/original only) is honoured.

### AC2 — Morph targets / shape keys for the proportion dimensions
**Met.** All three skinned meshes carry exactly six morph targets with
`extras.targetNames = [height, headSize, torsoWidth, armLength, legLength,
shoulderWidth]` — verbatim the canonical keys in MODEL_SPIKE.md, no aliases.
The targets genuinely deform (verified via accessor min/max deltas):
`height` +0.36 Y from feet, `legLength` up to −0.228 Y, `shoulderWidth`/`torsoWidth`
±0.29/±0.12 X, etc. `test/playerModelMorphs.test.js` passes (2/2) and asserts
both the exact six names and six bound targets on the body primitive.

The rest pose (influence 0.0) is the "short/narrow" extreme (feet y≈0.114, top
y≈1.593); at neutral (0.5) `legLength` lowers feet toward y≈0 and `height` lifts
the top toward ~1.8 m, reconstructing the normalized 02 base. This matches the
documented "0.0 = extreme, 0.5 = neutral, 1.0 = extreme" contract.

### AC3 — Decision note (source vs authored, license, poly budget, anchor/scale)
**Met.** `game/docs/SPIKE_DECISION.md` compares Quaternius vs Kenney vs authored,
states the CC0 choice and rationale, poly budget (~13k, ≤8k target if needed),
and normalization conventions. `game/docs/MODEL_SPIKE.md` is the canonical
contract: asset path, world-space conventions (feet y=0, −Z forward, 1.8 m,
PLAYER_RADIUS 0.5), the six proportion keys, clamp range, head anchor, and
authoring notes. `public/models/README.md` is a coherent author checklist. The
decompose note explains the note lives under `game/docs/` (not `tickets/`)
because implementer scope is `game/**`; reasonable and clearly documented.

## Design consistency / regressions

Consistent with `game/docs/design.md` direction (glTF avatars). No regression:
no runtime code changed, `MODEL_REGISTRY.player` stays `null`, added packages are
devDependencies only (`@gltf-transform/*`, `gl-matrix` for the rebuild scripts).
No debug scenarios were added.

## Remaining gaps

None blocking. The committed `player.glb` is ~16 MB, dominated by 7 embedded
textures; the body is ~12.6k tris vs the doc's optional ≤8k target. Neither
blocks a spike (the asset is dormant), but both are worth addressing before
ticket 187 wires it into the runtime — captured as nits.

VERDICT: PASS
