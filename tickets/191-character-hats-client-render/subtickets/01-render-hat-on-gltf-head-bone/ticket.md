# Render the equipped hat attached to the glTF avatar's head bone

The glTF player avatar (landed in ticket 187) hides every procedural primitive
when the model loads — including the procedural hat that `createPlayerAvatar`
seats on the procedural body — so equipped hats currently do not appear on the
glTF avatar. Attach the equipped hat to the loaded glTF's `Head` bone so it
renders (and follows the head) for the local player and all remote players, and
updates when the equipped hat changes.

## Acceptance Criteria
- When a player's cosmetic `hat` is a known non-`none` id (`cap`, `wizard`,
  `crown`, `bandana`, `beanie`), the loaded glTF avatar shows that hat's mesh
  attached to the glTF `Head` bone, so the hat inherits the head's position and
  orientation rather than floating at the group origin.
- When the cosmetic `hat` is `none` (or an unknown id) no hat mesh is added to
  the avatar — the glTF avatar renders a clean bare head.
- The glTF-attached hat is NOT hidden by the procedural-mesh-hiding step that
  runs when the model loads (the procedural body/accent are hidden but the
  head-bone hat stays visible).
- Changing a player's equipped hat at runtime swaps the rendered hat without a
  page reload: `none`→a hat adds the hat mesh; one hat→another swaps the mesh;
  any hat→`none` removes it. This holds for both the local player and remote
  players (the existing rebuild-on-`cosmeticSignature`-change path drives it).
- Hats render for the local player and for remote players (both go through
  `createPlayerAvatar` / the player render loop).
- The hat is sized and seated so it reads as worn on the glTF head (near the
  top of the head, upright in world space), not obviously floating above it or
  sunk through the body.
- Locating the head bone is resilient: if `Head` is absent the code falls back
  to a computed top-of-head anchor and never throws; no new console errors on
  load, and `pnpm test:quick` (from `game/`) still passes.

## Technical Specs
- Edit ONLY `game/client/renderer.js`.
- The head anchor is the `THREE.Bone` named **`Head`** inside `player.glb`
  (verified rig chain: `root → pelvis → spine_01..03 → neck_01 → Head`). Locate
  it on the loaded model with `model.getObjectByName('Head')`.
- In `createPlayerAvatar` (~line 1407): record the resolved hat id on the host
  so the async load callback can read it, e.g.
  `group.userData.hatId = AVATAR_HAT_IDS.has(c.hat) ? c.hat : 'none';`. The
  existing procedural group-level hat (seated at `bodyTopY(shape)`) stays as the
  procedural-fallback path; do not remove it.
- In `attachRegistryModel`'s player branch — the `loadModel(path).then(model => …)`
  callback (~lines 370–386), after `normalizeLoadedRegistryModel`, the body
  retarget, and `host.add(model)` — build the hat for `host.userData.hatId`
  (reuse `buildHatMesh`) and, when it is non-null, attach it to the head bone:
  - `const headBone = model.getObjectByName('Head');`
  - When found, `headBone.add(hat)` and compensate for the bone's world
    transform so the hat sits upright and at a sensible world scale (e.g. derive
    a scale factor from the bone's world scale via `getWorldScale`, and clear any
    inherited rotation so the hat's local +Y points up in world space). Seat it
    just above the head (small positive local offset along the head's up axis).
  - When the bone is missing, fall back to attaching the hat to `model` (or
    `host`) at a top-of-head anchor (~`PLAYER_MODEL_HEIGHT` ≈ 1.8, head center
    ≈ 1.62 per `MODEL_SPIKE.md`) so it still renders and never throws.
  - Store a reference (e.g. `host.userData.gltfHatMesh = hat;`) for clarity.
- The procedural-hiding snapshot (`procedural[]`) is collected BEFORE
  `loadModel` resolves, so a hat built inside the `.then` callback is naturally
  excluded from the `node.material.visible = false` loop — keep it built there
  (do not add the head-bone hat to the host before the snapshot).
- Equip-change handling needs no new diff path: `cosmeticSignature` already
  includes `hat` (line ~1386), so the render loop (~lines 3395–3404) disposes
  and rebuilds the avatar on a hat change, which re-runs `createPlayerAvatar` →
  `attachRegistryModel` → re-attaches the hat. Verify this rebuild path covers
  the equip-change criteria for local and remote players.
- `buildHatMesh` already produces meshes scaled for the ~1-unit procedural body;
  account for the glTF being normalized to ~1.8 units when choosing the hat's
  scale on the head bone so it is not undersized.

## Verification: code
