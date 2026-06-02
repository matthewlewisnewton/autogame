# Senior Review — 183-character-customization-client-panel

## Runtime health — CAPTURE FAILED (blocking)

The captured run did **not** complete cleanly, so there is no runnable proof of
this ticket. Per the runtime-health gate this is an automatic FAIL regardless of
code quality.

`metrics.json`:
- `"ok": false`
- `failure_kind: "capture_failed"`
- `capture_diagnosis.detected: []` (no specific signature classified)
- `port_holders`: `5173: []`, `3000: []` — **both** dev servers were already gone
  by the time the diagnosis ran.

`console.log` / `client.log`:
- Both players reached `[vite] connected`, then `[vite] server connection lost.
  Polling for restart...`, then a burst of `Failed to load resource:
  net::ERR_CONNECTION_REFUSED`, ending in `page.waitForFunction: Timeout 12000ms
  exceeded.`
- `pageerrors.json` is `[]` and `pageerrors` in the capture record is empty — **no
  uncaught browser exceptions**.

`server.log`: clean startup (`Server listening on port 3000`, a player connected),
then logging simply stops — no crash, no stack trace, no game error.

`01-initial.png` shows the lobby UI fully rendered (the bundle loaded and ran)
with a "Connection failed — retrying…" banner — i.e. the page booted, then the
socket connection to the now-departed server dropped.

### Why this is NOT a code defect in this ticket

- There are **zero page errors** — the JS bundle (including the new
  `cosmetic-preview.js`, the customization handlers, and the `disposeAvatar`
  export) loaded and executed without throwing.
- The failure signature is the **vite dev server (:5173) going away** ("server
  connection lost" + `ERR_CONNECTION_REFUSED`) together with the **game server
  (:3000) going away** (both ports empty in `port_holders`). That is the dev
  harness/servers terminating mid-run, not a fault in the page.
- This ticket's diff is **100% client-side** (`game/client/*`); the game server
  on :3000 is not touched by a single line, so the server disappearing cannot be
  caused by this ticket.
- The fallback smoke flow is "auth, lobby create/join, ready transition,
  movement" — it **never opens the Account overlay**, so the customization panel
  and its preview are never even exercised during capture.

This is an infrastructure / capture flake (dev servers dropped out before the
flow finished), not a regression introduced by the code under review.

## Harness blockers

```
failure_kind: "capture_failed"   (capture_diagnosis.detected: [])
console: [vite] server connection lost. Polling for restart...
console: Failed to load resource: net::ERR_CONNECTION_REFUSED  (x8)
capture: page.waitForFunction: Timeout 12000ms exceeded.
port_holders: { "5173": [], "3000": [] }
```
Both dev servers were unreachable mid-capture with no game-code trace. The next
round should **re-run the capture**, not edit `game/`.

## Per-criterion findings (code judged on its merits)

Independent of the failed capture, the implementation fully and correctly
satisfies the acceptance criteria. Were the capture to have succeeded, the code
would have passed.

### Sub-ticket 01 — controls, state & save
- **Character section with three controls** — ✅ `index.html` adds
  `#cosmetic-section` with body-color swatches (`#cosmetic-body-swatches`),
  accent-color swatches (`#cosmetic-accent-swatches`), and a body-shape
  `<select id="cosmetic-shape-select">` offering exactly `box`, `cylinder`,
  `cone`, `capsule` — matching server `BODY_SHAPES` (`game/server/cosmetic.js:6`).
- **`settings.js` caches cosmetic + `getAccountCosmetic()`** — ✅
  `loadAccountSettings` sets `cachedCosmetic = normalizeCosmetic(data.cosmetic)`;
  `getAccountCosmetic()` returns `{ bodyColor, accentColor, bodyShape }` with
  fallbacks. The client `DEFAULT_COSMETIC` exactly mirrors the server's
  (`#4f9dde` / `#f2c94c` / `box`).
- **Opening syncs controls to cached value; persists across reload** — ✅
  `syncCosmeticForm()` is called from `openAccountOverlay`; re-login reloads via
  `loadAccountSettings` → `GET /api/me`.
- **Save persists via `patchProfile`** — ✅ `#cosmetic-save-btn` calls
  `patchProfile({ cosmetic })`; on success `patchProfile` updates `cachedCosmetic`
  from `data.cosmetic`, and the handler re-syncs the form.
- **Save errors surfaced** — ✅ `patchProfile` returns `{ error }` on a non-ok
  response; the handler shows it via `#cosmetic-error` (`showCosmeticError`).
- **`#RRGGBB` + valid shape enum sent** — ✅ both palettes are `#RRGGBB`
  constants defined client-side; shape comes from the four-option select. These
  pass the server's `HEX_COLOR_REGEX` / `BODY_SHAPES` validators.

### Sub-ticket 02 — live 3D preview
- **Dedicated preview element from current selection** — ✅
  `#cosmetic-preview-canvas`; `cosmetic-preview.js` builds a self-contained
  scene/camera/renderer.
- **Reuses `createPlayerAvatar(cosmetic, isSelf)`** — ✅ imported from
  `renderer.js` (`createPlayerAvatar(cosmetic, true)`); no duplicated geometry.
- **Updates on every control change without save/reload** — ✅ each swatch click
  and the shape `change` handler call `refreshCosmeticPreview()` →
  `updatePreview()`.
- **Init from cached cosmetic; resources created on open, disposed on close** —
  ✅ `openCosmeticPreview` runs in `openAccountOverlay`; `closeCosmeticPreview`
  runs in `closeAccountOverlay`, cancelling the RAF loop and calling
  `disposeAvatar` + `renderer.dispose()`. `openPreview` calls `closePreview`
  first, so repeated open/close neither leaks meshes nor stacks render loops.
- **Self-contained, does not disturb the main scene** — ✅ entirely private
  module-level scene/camera/renderer bound to its own canvas; the render loop
  only runs while open.

### Consistency / regressions
- Consistent with the existing cosmetic foundation (181/182). The only
  non-additive change is exporting the already-present `disposeAvatar` from
  `renderer.js` — safe, reused for correct teardown.
- No debug scenarios added.
- Unit tests: 209 passed (`coverage.log`). No new console errors attributable to
  the code.

## Remaining gaps

1. **(Blocking — infra)** No runnable proof: the capture failed because both dev
   servers (vite :5173 and game :3000) became unreachable mid-run. This is a
   harness/capture flake, not a code defect (no page errors, no server crash
   trace, and the ticket touches no server code). Re-run the capture; do not edit
   `game/`.

VERDICT: FAIL
