# 01 — Lobby UI Shell (HTML + CSS, defer Three.js init)

Add a lobby overlay `<div>` to the page, style it, and restructure `main.js` so that the Three.js scene is **not** initialized on page load. Instead, scene creation is deferred to a function `initScene()` that will be called later (by sub-ticket 03).

On first load, the lobby div is visible and the Three.js canvas does not exist yet. The existing `#ui` status panel and `#card-hand` remain in the DOM but are hidden behind the lobby overlay.

## Acceptance Criteria
- Opening the client page shows a full-screen lobby overlay with a title ("Lobby") and an empty player list area
- No Three.js canvas is rendered on the page at this point (no WebGL context, no dark 3D background)
- The lobby overlay covers the entire viewport; existing UI elements (`#ui`, `#card-hand`) are not visible behind it
- A placeholder "Ready" button is present but does nothing yet (no socket event wired)
- Calling `initScene()` from the browser console creates the Three.js scene and canvas exactly as before (same floor, lights, player cube)

## Technical Specs
- **`game/client/index.html`** — Add `<div id="lobby">` containing an `<h2>` title, a `<ul id="lobby-player-list">`, and a `<button id="ready-btn">Ready</button>`. Place it after `#ui` and `#card-hand`.
- **`game/client/style.css`** — Style `#lobby` as a full-screen flex column overlay (dark background, centered content, white text). Hide `#ui` and `#card-hand` when `#lobby` is visible (use `display: none` on `#ui` and `#card-hand` by default; they'll be shown later when the game starts).
- **`game/client/main.js`** — Wrap all Three.js setup (scene, camera, renderer, floor, lights, `animate()`) inside a function `function initScene() { ... }`. Do **not** call it at the top level. Export it or attach it to `window` so later code can invoke it. Leave all socket/connection code at the top level unchanged.

## Verification: visual
