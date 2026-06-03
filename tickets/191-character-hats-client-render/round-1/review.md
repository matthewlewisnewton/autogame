# Senior Review — 191-character-hats-client-render

## Runtime health (capture)
- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started (vite on :5174,
  game server on :3001), scene initialized for both players (`sceneInitialized: true`,
  `phase: "playing"`).
- `console.log`: only `[initScene]` logs and a `409 Conflict` on a resource fetch
  (benign — an HTTP response during the auth/lobby flow, not a page error or fatal).
- `client.log`: only THREE.Clock deprecation warnings and a `ws proxy ECONNRESET`
  on socket close — all explicitly-benign noise.
- `coverage.log`: `pnpm test:quick` → **187 tests passed (8 files)**. (One stack
  trace line in the log is a `console.warn` from a test exercising the
  `attachRegistryModel` load-failure path — handled gracefully, suite is green.)
- Screenshots show both default players (`hat: "none"`) rendering a clean bare
  avatar with no floating mesh — the negative AC is verified live.

The game starts and loads cleanly. No blocking runtime issues.

## Scope of change
`git diff b1edaf0..HEAD` touches only `game/client/renderer.js` (+82 lines) plus
the sub-ticket file — matches the ticket's "edit ONLY renderer.js" constraint.
New `attachGltfHat(host, model)` + a `group.userData.hatId` record; wired into
the player branch of `attachRegistryModel`'s load callback.

## Per-criterion findings

1. **Known non-`none` hat shows on the glTF `Head` bone** — PASS (code).
   `attachGltfHat` builds the hat via `buildHatMesh(host.userData.hatId)` and
   `headBone.add(hat)` after `model.getObjectByName('Head')`. Parenting to the
   bone makes the hat inherit head position/orientation rather than the group
   origin. Player model path is real (`/models/player.glb`), so this branch runs.

2. **`none`/unknown → no hat, clean bare head** — PASS. `buildHatMesh` returns
   `null` for `none`/unknown; `attachGltfHat` early-returns. Confirmed live: the
   captured default players (`hat:none`) render bare heads with no errors.

3. **Head-bone hat NOT hidden by the procedural-hiding loop** — PASS. The
   `procedural[]` snapshot is taken before `loadModel` resolves; the hat is built
   inside the `.then` callback, so it is never in the `material.visible = false`
   set.

4. **Runtime equip-change swap (local + remote)** — PASS. `cosmeticSignature`
   includes `hat`; the per-frame loop (renderer.js:3473) disposes + rebuilds the
   avatar when the signature differs, re-running `createPlayerAvatar` →
   `attachRegistryModel` → `attachGltfHat`. Covers none→hat, hat→hat, hat→none
   for every player in `gs.players` (local and remote alike).

5. **Renders for local and remote** — PASS. All avatars are created through the
   same `createPlayerAvatar` path in the render loop; no self/remote divergence
   in the hat code.

6. **Sized & seated upright** — PASS (code). `HAT_HEAD_WORLD_SCALE = 0.45`
   compensates for the glTF being normalized to ~1.8u (vs the ~1u procedural body
   `buildHatMesh` targets), divided by the bone's world scale. The quaternion
   `inverse(boneWorld) * hostWorld` makes the hat's world orientation equal the
   host's (upright, yaws with the avatar); a `+0.18`-world-unit up offset seats it
   above the head. Math checks out: child-of-bone world rot = boneWorld·hatLocal =
   hostWorld, and it stays aligned as the host yaws.

7. **Resilient + no new errors + test:quick passes** — PASS. Missing `Head`
   falls back to attaching at `HAT_FALLBACK_WORLD_Y = 1.72` on the host; the whole
   routine is also wrapped by the caller's `.catch`. No new console errors on the
   captured load; 187 unit tests pass.

## Remaining gaps
None blocking. All acceptance criteria are met; the captured run is clean.

(Note: the deterministic smoke capture uses default users with `hat:none`, so the
positive hat-on-head path is verified by code review + the sub-ticket's own visual
QA rather than this capture. The capture does positively confirm the bare-head
case, clean load, and no regressions.)

VERDICT: PASS
