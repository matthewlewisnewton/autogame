# Senior Review — 182 character-customization-client-render-avatar

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block, servers
  started (`http://localhost:5173/`), capture reached `phase: "playing"` with 2 players
  and a live canvas (`hasCanvas: true`, `sceneInitialized: true`).
- `console.log`: only `[vite] connecting/connected` and `[initScene] Initializing
  Three.js scene...` — no `pageerror`/`[fatal]` lines.
- `client.log`: only benign `[vite] ws proxy error: ECONNRESET` on socket close (ignored
  per the runtime-noise allowlist). `server.log` clean.
- `pageerrors.json`: `[]`.
- Screenshots confirm avatars actually render: `02-after-w.png` shows the local player as
  a cosmetic avatar (box body in the default `#4f9dde` blue with the gold accent band), a
  remote player box in the background, and the shield disc — no visual breakage.

The game starts and loads cleanly. Gate passes.

> Note: the top-level `ticket.md` is absent from the ticket folder (the decomposer noted
> this and reconstructed scope from the branch title + shipped server work). I judged
> against the two sub-tickets' acceptance criteria, which fully cover the intended scope:
> client rendering of the already-broadcast `cosmetic` profile (body shape/colors + hat).

## Per-criterion findings

### Sub-ticket 01 — body shape and colors
- **Builder returns a `THREE.Group`, shape→geometry mapping, box fallback** — ✅
  `createPlayerAvatar` (renderer.js:1165) builds a Group; `buildBodyGeometry`
  (renderer.js:1085) maps `box`→Box, `cylinder`→Cylinder, `cone`→Cone, `capsule`→Capsule,
  with `default`→Box. Unknown/missing shape is normalized to `box` via
  `AVATAR_BODY_SHAPES.has(...)`.
- **Body color from `bodyColor`, accent child from `accentColor`, invalid→default, no
  crash** — ✅ `avatarColorHex` validates `#RRGGBB` and falls back to
  `DEFAULT_AVATAR_BODY_COLOR`/`DEFAULT_AVATAR_ACCENT_COLOR`. The accent is a thin cylinder
  band (renderer.js:1184). Non-object/array cosmetics are coerced to `{}` defensively.
- **Both local and remote use the builder; old hardcoded box/blue-vs-red removed** — ✅
  The single mesh-creation site (renderer.js:2924) now calls `createPlayerAvatar` for every
  player id including `myId`. The old `new THREE.BoxGeometry(1,1,1)` + `0x3b82f6`/`0xf43f5e`
  block is gone. (Color is now cosmetic-driven for all, so remote players default to the
  same blue as local — an intentional consequence of the ticket, not a bug.)
- **Rebuild on cosmetic change via signature** — ✅ `cosmeticSignature` produces a stable
  `shape|body|accent|hat` key stored on `userData.cosmeticKey`; the frame loop disposes
  (`disposeAvatar` traverses + disposes all geo/mat) and `scene.remove`s the old group, then
  rebuilds, when the broadcast signature differs (renderer.js:2927-2933).
- **Dead/i-frame/HP-flash retargeted to body mesh** — ✅ Dead gray and base-color restore
  use `userData.bodyMesh` for both remote (renderer.js:2945-2949) and local
  (renderer.js:2990-2994); i-frame transparency uses `selfBody` (renderer.js:2997-3005);
  `flashMesh` resolves the body mesh via `resolveBodyMesh` (renderer.js:1244). No remaining
  `playersMeshes[id].material/.geometry` accesses (grep confirms zero).
- **Dash + shield VFX work on the group** — ✅ `triggerDashVFX` applies squash scale to the
  group while taking ghost geometry/material from the resolved body mesh
  (renderer.js:1283-1313); `triggerShieldVFX` only reads the group's `position`/`rotation`
  and builds its own disc, so it never touches `.material`/`.geometry`. No undefined-access
  risk. Smoke run shows no new console errors.

### Sub-ticket 02 — hat
- **Hat child by id, none/unknown→no hat** — ✅ `buildHatMesh` (renderer.js:1126) returns a
  cap (cylinder + brim), wizard (tall cone), crown (gold torus), and `null` for
  `none`/default. Added to the group only when non-null.
- **Positioned on the head per body shape, rotates with group** — ✅ Hat seated at
  `bodyTopY(shape)` (accounts for the taller capsule) and added as a group child, so it
  inherits rotation (renderer.js:1190-1196).
- **Crown gold, hats mutually distinguishable** — ✅ cap forest-green, wizard deep-purple,
  crown gold (`metalness/roughness` tuned), all distinct from the default body/accent.
- **Rebuild includes hat; geometry disposed; no leaks** — ✅ `hat` is part of
  `cosmeticSignature`, and `disposeAvatar` traverses the whole group (hat included).
- **Applies to local and remote, no console errors** — ✅ Same single builder path for all
  players; clean smoke run.

## Debug scenarios (`custom-avatar-demo`, `avatar-wizard-hat`)
Both added to `DEBUG_SCENARIOS` and applied only through `applyDebugScenario`, which is
reachable solely via the `debugScenario` socket event gated by `isDebugScenarioAllowed`
(index.js:3480-3488) — normal gameplay never touches them.
- **Same end-state reachable normally** — ✅ A non-default cosmetic is settable through the
  validated profile route (`users.js:243-255` via `validateCosmetic`), persisted on the
  account, and loaded onto the in-run player (`index.js:1062`), then broadcast
  (`progression.js:3114`). The scenarios just pre-seed `player.cosmetic` to skip the UI.
- **Invariants not short-circuited** — ✅ The relevant invariant for *this* ticket is the
  broadcast→client-render pipeline, which the scenarios exercise fully (they set the
  server-side cosmetic that is replicated normally). The values set are all valid
  (catalog shapes/hats, valid hex). Hat-unlock/currency validation belongs to #189's flow,
  not this rendering ticket; the normal equip path remains intact and validated.

## Consistency with design / foundation
Body-shape vocabulary (`box`/`cylinder`/`cone`/`capsule`) and hat ids
(`none`/`cap`/`wizard`/`crown`) mirror the server's `BODY_SHAPES`/`HAT_CATALOG` — no
invented names. Change is confined to client rendering plus two debug scenarios; no
gameplay/foundation regression. Coverage log shows the existing server suite runs clean.

## Remaining gaps
None blocking. (See `nits.md` for minor non-blocking polish.)

VERDICT: PASS
