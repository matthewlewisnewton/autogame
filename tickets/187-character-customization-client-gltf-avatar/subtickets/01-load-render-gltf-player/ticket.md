# Load & render the glTF player avatar (with VFX preservation)

Wire `MODEL_REGISTRY.player` to the committed `player.glb` so the glTF humanoid
replaces the procedural primitive for both local and remote players, seated and
oriented correctly, with the procedural primitive kept as a fallback. Retarget
the existing avatar VFX (flash / invuln / dash / dead) to the loaded skinned
mesh so they remain visible after the model swap.

## Acceptance Criteria
- `MODEL_REGISTRY.player` in `game/client/models.js` is set to
  `'/models/player.glb'` (no longer `null`).
- The glTF model loads via the existing `loadModel` / `attachRegistryModel`
  infrastructure and renders in place of the procedural body for BOTH the local
  player and remote players.
- The loaded model is normalized so its feet (model y = 0) sit on the sampled
  floor: it is uniformly scaled to ~1.8 world-units tall and seated so the host
  group's origin (positioned at `(x, floorY, z)`) puts the soles on the floor —
  i.e. a `player` footprint/vertical-offset is added alongside the existing
  enemy/minion entries rather than left as the `null` default.
- Forward facing is preserved: the model faces −Z and follows the existing
  `rotation.y = playerRotation − π/2` (local) / `pData.rotation − π/2` (remote)
  rule already applied to the avatar group — no extra per-model rotation that
  breaks this.
- Procedural fallback: when `player.glb` is missing or fails to load
  (`loadModel` resolves `null`), the procedural primitive remains visible and
  nothing throws — the registry path is the only thing gating the swap.
- VFX preserved on the visible glTF mesh after the swap:
  - flash on HP drop (`flashMesh`) lights the loaded mesh, not the hidden
    procedural body;
  - dead state recolors the loaded mesh to `DEAD_AVATAR_COLOR` and restores
    `baseColor` on revive;
  - invulnerability shimmer (transparent / opacity 0.5) applies to the loaded
    mesh;
  - dash squash + ghost trail (`triggerDashVFX`) reads geometry/material from
    the loaded mesh.
  This is done by retargeting `group.userData.bodyMesh` (and re-applying
  `baseColor`) to the glTF skinned mesh once the model resolves, so the existing
  `resolveBodyMesh`-based VFX code keeps working unchanged.
- Existing tests still pass (`pnpm test:quick` from `game/`).

## Technical Specs
- `game/client/models.js`: set `MODEL_REGISTRY.player = '/models/player.glb'`.
- `game/client/renderer.js`:
  - `getRegistryTargetFootprint('player')` / `getRegistryHostVerticalOffset('player')`:
    add a `player` case returning a `targetHeight ≈ 1.8` footprint (and the
    correct host vertical offset given the avatar group is positioned with its
    origin at floor y) so `normalizeLoadedRegistryModel` scales/seats the model.
    Reuse the spike contract in `game/docs/MODEL_SPIKE.md` (height 1.8, feet at
    y = 0, footprint within `PLAYER_RADIUS = 0.5`).
  - `attachRegistryModel` (or a small player-specific branch it calls): after a
    successful player load, locate the skinned body mesh (the `SkinnedMesh` that
    carries `morphTargetDictionary`, e.g. `SuperHero_Male`) and set
    `host.userData.bodyMesh` to it, keeping `host.userData.baseColor` consistent
    so `flashMesh`, the dead/invuln recolor branches, and `triggerDashVFX`
    (which all resolve through `userData.bodyMesh` / `resolveBodyMesh`) act on
    the visible model. Do not remove the procedural meshes from the group — the
    existing code hides them via `material.visible = false`.
  - `createPlayerAvatar` already calls `attachRegistryModel('player', group)`;
    keep the procedural build path intact for the fallback.
- Do NOT apply proportions morphs or color tint to the glTF here — that is
  sub-ticket 02. Tinting/morphs may still target the procedural body in this
  pass; this ticket only makes the model load, seat, render, and keep VFX alive.

## Verification: code
