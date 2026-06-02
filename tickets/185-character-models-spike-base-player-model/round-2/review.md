# Senior review: 185-character-models-spike-base-player-model (round 2)

**Scope source:** Beads issue `autogame-0yf` (top-level `ticket.md` is absent from this worktree; see `decompose.txt`). **Baseline:** `aa963b34eaad3701c4de5ea56af2bb4b368d178d`. **Commits:** `1500d50` (base GLB + license + README), `8b7c28e` (morph targets + validation test + inject script), `cba89e0` (MODEL_SPIKE decision doc).

## Runtime health (capture proof)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| Servers started (`url` localhost:5176) | Pass |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `harness_failure` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines. Vite connect, `[initScene]`, and benign `409 (Conflict)` on resource load (harness auth noise, not uncaught game exceptions). THREE.Clock deprecation and Vite `EPIPE` appear only in `client.log` — ignored per harness rules. |

**Capture behavior:** Fallback smoke flow reached `phase: "playing"`, canvas + card hand visible, two players, five+ enemies, movement probes (HP 100→94, position changed). Procedural box avatar still renders (expected — no loader wiring in this ticket).

## Acceptance criteria (`autogame-0yf`)

### 1. Base humanoid `.glb` under `game/client/public/models` with documented license

**Met.**

- `game/client/public/models/player.glb` committed (~43 KB glTF 2.0 binary; magic `glTF`, JSON chunk parses).
- `game/client/public/models/player.glb.license.md` — SPDX **CC0-1.0**, author/source, attribution optional.
- `game/client/public/models/README.md` documents filename, scale/anchor table, poly budget (~740 tris, 2 PBR mats), link to decision doc.
- Independent bbox check: height **~1.84** (Y 0.080–1.922), feet sole **Y ≈ 0.08**, forward thin axis on **Z** (~±0.165 depth vs ~±0.556 width on X) — matches README / MODEL_SPIKE conventions (1.6–2.0 height band, −Z forward).
- Asset is a **static** humanoid (0 skins, 0 animations). Beads description mentions “rigged,” but the spike AC only requires a base humanoid; sub-ticket 02 explicitly allowed static mesh suitable for morph authoring. Appropriate for proportion morphs (186–188), not skeletal animation.

### 2. Morph targets / shape keys for proportion dimensions

**Met.**

- Six morph targets on body primitive 0: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth` — `extras.targetNames` matches README table case-sensitively.
- Visor primitive 1 has **no** morph targets (body-only proportions).
- `game/client/test/playerModel.test.js` — 3/3 tests pass under `vitest run` and round-2 `coverage.log`; asserts README ↔ GLB name parity and target count.
- README documents Blender authoring constraints, export settings, and maintainer script `client/scripts/inject-player-morph-targets.mjs` for delta regeneration.
- Neutral rest pose at influence 0 (standard glTF morph semantics; deltas are offsets from rest positions).

### 3. Short decision note (source vs authored, license, poly budget, anchor/scale)

**Met (relocated path — intentional remediation).**

- Original beads AC asked for the note in the **ticket dir**; round-1 sub-ticket 01 failed because implementers cannot write `tickets/**` (`harness/roles.yaml`). Round-2 sub-ticket 04 delivered `game/docs/MODEL_SPIKE.md` with all required sections: source vs authored table, license (CC0-1.0), poly budget (target + measured ~740 tris), anchor/scale vs `renderer.js` box conventions, downstream pointer to `proportions.<key>`.
- `README.md` links to `../../../docs/MODEL_SPIKE.md`.
- Content matches committed asset and license file; no contradiction found.

## Consistency with `game/docs/design.md` and `requirements.md`

- **design.md:** No gameplay-loop, combat, or networking changes. Asset-only spike; renderer still uses `BoxGeometry(1,1,1)` for players (`renderer.js` ~2694) until ticket 161 — documented everywhere.
- **requirements.md:** Foundation intact — 3D scene initializes, WebSocket multiplayer, player in world, WASD movement (capture probes show position sync and dungeon play). No regression observed.

## Code quality

- **Diff scope:** Only `game/client/public/models/*`, `game/client/test/playerModel.test.js`, `game/client/scripts/inject-player-morph-targets.mjs`, `game/docs/MODEL_SPIKE.md`, and ticket metadata under `tickets/.../subtickets/` — no renderer, server, or loader changes.
- **Tests:** `playerModel.test.js` is focused, zero new npm deps (GLB JSON chunk parse only).
- **Dead code:** Inject script is a documented maintainer tool, idempotent skip when morphs already present.
- **Console:** Clean per capture rules above.

## Debug scenarios

This ticket did **not** add or modify any `?debugScenario=` flow. Capture probes show `debugScenario: null` throughout. N/A.

## Integration / holistic notes

- Sub-tickets 02–03 passed prior visual QA; round-2 added only the missing decision doc (04). The three game commits form a coherent deliverable: asset + schema + validation + decision record.
- Screenshots listed in `metrics.json` are not present on disk under `round-2/` in this worktree; runtime proof rests on `metrics.json` probes and logs (sufficient for health gate).
- Morph deltas were generated programmatically (inject script) rather than Blender shape-key export; schema and names are stable for downstream tickets. Visual quality of morph deformation at ±1 is not exercised in-game (loader not wired) — acceptable for this spike; ticket 187 should validate appearance.

## Remaining gaps

No blocking gaps. Runtime is healthy; all beads acceptance criteria are satisfied in substance (decision note at `game/docs/` instead of `tickets/` is the documented harness remediation, not missing work).

---

VERDICT: PASS
