# Senior Review — 183 Character Customization (Client Panel)

Top-level ticket source: beads issue **autogame-cgf** (the worktree `ticket.md`
was absent; `decompose.txt` records this and decomposition followed the bead).
Built on base `06f58bc9`. Server-side cosmetic profile (ticket 181 /
autogame-268) is already merged and provides `GET /api/me` + `PATCH
/api/me/profile` with cosmetic support.

## Runtime health

- `metrics.json`: `"ok": true`, `pageerrors: []`, `phase: "playing"`,
  `sceneInitialized: true`, two players connected, gameplay reached.
- `console.log`: only `[vite] connecting/connected`, `[initScene]`, and two
  `409 (Conflict)` resource lines — the benign register-then-login auth pattern
  (account already exists). No `pageerror`/`[fatal]` lines from game code.
- `server.log`: clean startup, layout generated, players connect/disconnect
  normally. No `harness_failure`.
- Screenshots `01`–`03` show the lobby and live 3D gameplay rendering, with the
  HUD character portrait (top-left, blue-tinted = default `#4f9dde`) and the
  toolbar account button (top-right) present in both lobby and in-run.
- Client unit tests: 225 passed across 11 files (per `coverage.log` and a fresh
  local `vitest run`). The failures in `review-attempt.txt` are a misconfigured
  invocation (run outside the client jsdom config: "document is not defined"),
  not real failures.

Game runs and loads cleanly. ✓

## Acceptance criteria (top-level)

**1. Panel offers color palette, accent picker, and shape picker** — ✓
`index.html` adds an `#cosmetic-appearance-section` "Appearance" section inside
`#account-modal`: a `role="radiogroup"` shape group (box/cylinder/cone/capsule),
a 6-swatch body-color grid + `#cosmetic-body-custom` color input, a 6-swatch
accent grid + `#cosmetic-accent-custom`, plus `#cosmetic-save-btn` and a hidden
`#cosmetic-error`.

**2. Live preview reflects selection** — ✓ `cosmetic-preview.js` owns a
Three.js scene/camera/renderer and renders the correct primitive per shape
(`Box/Cylinder/Cone/Capsule` geometry) with `bodyColor` body material and an
emissive accent ring colored by `accentColor`. `main.js` wires every shape
button, swatch click, and custom-color `input` to `updateCosmeticPreview`
immediately (no server round-trip). Shape changes dispose the prior geometry
and reuse the shared materials — no GPU leak. Invalid shape/hex fall back to
defaults. Init is lazy on first overlay open and guarded against repeat init.

**3. Save persists via profile route** — ✓ `#cosmetic-save-btn` builds
`{ cosmetic: { bodyColor, accentColor, bodyShape } }` and calls
`patchProfile`, which PATCHes `/api/me/profile`. The button disables during the
request and re-enables after. No-op when the draft equals the cached cosmetic.

**4. Selection survives reload** — ✓ `loadAccountSettings()` reads
`data.cosmetic` from `GET /api/me` through `backfillCosmetic` (validates hex +
shape, fills defaults). `patchProfile` updates the cache from the 200 payload;
a failed (4xx) PATCH returns `{ error }` and leaves the cache untouched. Server
(`account.js`/`cosmetic.js`) validates and persists, so a reload re-reads the
saved values. Defaults match server (`#4f9dde` / `#f2c94c` / `box`).

**5. Visible in-run** — ✓ `updateVanguardPortraitCosmetic` styles
`#character-frame` (body-color radial gradient background, accent border + glow,
`data-body-shape` attribute). `refreshVanguardPortraitCosmetic` is called after
login (`restoreSession` → `loadAccountSettings`), inside `updateVanguardPortrait`
(when `myId` is set), and after a successful save — so the saved look shows on
the HUD portrait while playing without touching world avatar meshes (ticket 182).

**6. Lives alongside existing lobby/settings UI** — ✓ The section sits in the
existing account overlay (reachable from the toolbar account button in both
lobby browser and in-lobby), after the display-name section and before logout.
No duplicate customization UI in the dungeon HUD card area; the username save
flow is untouched.

## Consistency / regressions

- `design.md` and `requirements.md` contain no cosmetic spec to contradict;
  this is the Phase-A surfacing of an already-merged server feature.
- Changes are confined to client UI + a new client state field; no server,
  gameplay, or networking paths altered. No regression to the running game
  (capture confirms normal auth → lobby → gameplay → movement).
- No debug `?debugScenario=` shortcut was added by this ticket.

## Code quality

- Logic is cleanly split: `settings.js` (state/round-trip), `cosmetic-form.js`
  (pure DOM/draft helpers), `cosmetic-preview.js` (Three.js), `main.js`
  (wiring). All validate input and fall back to defaults.
- No console errors from this code in the capture; modules import cleanly
  (scene initialized, no page errors).

## Remaining gaps

None blocking. One minor nit (recorded in `nits.md`): `readCosmeticDraft` in
`cosmetic-form.js` is exported and unit-tested but unused by `main.js`, which
maintains the draft incrementally — slightly redundant, non-blocking.

VERDICT: PASS
