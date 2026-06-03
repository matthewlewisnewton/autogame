# Senior review — 187 character-customization-client glTF avatar

Top-level ticket: render the glTF player avatar (replacing the procedural
primitive) with proportion morph influences, body/accent tint, and a safe
procedural fallback — derived from `decompose.txt` + the two sub-ticket
contracts + `game/docs/MODEL_SPIKE.md` (the top-level `ticket.md` was not
present on disk; criteria reconstructed from those authoritative sources).

## Runtime health — PASS
- `round-1/metrics.json`: `"ok": true`, `pageerrors: []`, `pageerrors.json` is
  `[]`. No `failure_kind` / `harness_failure` block.
- Probe shows the game fully reached gameplay: `phase: "playing"`,
  `connectionState: "connected"`, `sceneInitialized: true`, `hasCanvas: true`,
  `canvasCount: 2`, `players: 2`, enemies spawning, dodge cooldown HUD working.
- `console.log` is clean — only `[vite] connecting/connected`, a benign 409 on
  lobby create, and `[initScene]`. `client.log` only has the allowed THREE.Clock
  deprecation and `ws proxy EPIPE` noise. No `[renderer] failed to apply model`
  warning → `player.glb` (1.0 MB, present on disk) loaded successfully.
- `pnpm test:quick` from `game/`: **68 files / 1604 tests passed**.

## Per-criterion findings

**1. Registry wired to the committed glTF — MET.**
`game/client/models.js`: `MODEL_REGISTRY.player = '/models/player.glb'` (was
`null`). Asset exists at `game/client/public/models/player.glb`. Covered by the
updated `models-registry.test.js`.

**2. Loads/renders for local AND remote, procedural hidden not removed — MET.**
`attachRegistryModel('player', …)` runs for every avatar built by
`createPlayerAvatar`, which is called for all players in the animate loop. On
load it hides the procedural meshes via `material.visible = false` and adds the
glTF as `host.userData.modelOverride`. Unit test asserts the swap + procedural
hidden (visible === false).

**3. Normalized to ~1.8, feet at y=0, seated on floor — MET.**
`getRegistryTargetFootprint('player')` returns `{ targetHeight: 1.8 }`
(`PLAYER_MODEL_HEIGHT`) and `getRegistryHostVerticalOffset('player')` returns
`0` — correct because the host group origin is placed at `(x, floorY, z)` and
the model is normalized feet-at-0. Matches `MODEL_SPIKE.md`. Test asserts the
1.8 footprint.

**4. Forward facing −Z preserved — MET.** No per-model rotation added; the
existing `rotation.y = playerRotation − π/2` (local) / `pData.rotation − π/2`
(remote) rules are untouched.

**5. Procedural fallback on load failure — MET.** `attachRegistryModel`'s
`.catch` only logs `console.warn`; `userData.bodyMesh` stays on the procedural
body, `modelOverride` is never set, and `applyLoadedModelCosmetic` no-ops on the
missing `modelOverride`. Dedicated unit test drives `onError` and asserts the
procedural body stays visible and is still the VFX target.

**6. VFX retargeted to the loaded mesh — MET.** `retargetPlayerBodyMesh` points
`userData.bodyMesh` at the morph-carrying `SkinnedMesh` (`findPlayerBodyMesh`
prefers morph → skinned → any mesh), **clones the material per-player** so
recolors don't bleed across avatars sharing the cloned glTF, and seeds
`userData.baseColor`. flash/dead/invuln/dash all resolve through
`userData.bodyMesh`/`resolveBodyMesh`, so they act on the visible model.

**7. Proportion morphs 1:1 by identical name — MET.** `applyProportionMorphs`
iterates the six `PROPORTION_MORPH_KEYS` (`height, headSize, torsoWidth,
armLength, legLength, shoulderWidth`) and writes
`morphTargetInfluences[morphTargetDictionary[key]] = proportions[key]` with no
alias layer. Absent keys (`hasOwnProperty` guard), non-finite values, and
unknown morph names are each skipped, leaving the rest influence — no
`undefined` writes. Matches `MODEL_SPIKE.md` exactly.

**8. Body/accent tint — MET (with a documented accent limitation).** Body color
routes through `userData.baseColor` (via `avatarColorHex` + default fallback),
which the dead/flash/invuln recolor paths re-apply every frame for both local
and remote players, so dead/flash/invuln correctly still win when active.
Accent is applied only when the body mesh exposes a distinguishable second
material; the committed `SuperHero_Male` mesh carries a single material, so
accent has no separate surface and is intentionally left untinted — this is
explicitly permitted by the sub-ticket-02 AC and `MODEL_SPIKE.md` ("do not
invent a second mesh"). Noted as a follow-up nit, not a gap.

**9. Live updates without reload — MET.** `applyLoadedModelCosmetic` is invoked
each frame in the animate loop, before the recolor paths read `baseColor`, so
proportion + tint changes from a broadcast cosmetic take effect with no rebuild
(proportions are deliberately re-applied on the existing mesh rather than added
to `cosmeticSignature`).

**10. Fallback safety no-op — MET.** Both `applyProportionMorphs` (guards on
`morphTargetDictionary`/`morphTargetInfluences`) and `applyLoadedModelCosmetic`
(guards on `modelOverride`/`bodyMesh`) are no-ops under the procedural fallback.

**Debug scenario `avatar-proportions-demo` — OK.** New scenario added to
`game/server/index.js`. It is gated behind the same `isDebugScenarioAllowed(socket)`
check as every other scenario (only reachable via the `debugScenario` socket
path), sets `cosmetic.proportions` strictly within the server clamp
(0.75–1.25), and does not short-circuit any validation/persistence — the same
end-state is reachable normally by saving proportions via the
character-customization route (ticket 186) and starting a run. The capture ran
normal flow (`debugScenario: null`), confirming the scenario is not on the
normal path.

## Remaining gaps
None blocking. The only notable shortfall — accent tint not visible on the
single-material `player.glb` — is explicitly sanctioned by the sub-ticket/spike
contract and filed as a nit. Code is clean, all unit tests pass, and the
captured run is healthy.

VERDICT: PASS
