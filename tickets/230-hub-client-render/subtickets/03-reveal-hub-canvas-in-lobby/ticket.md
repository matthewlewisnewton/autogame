# Reveal the rendered hub canvas behind the lobby UI during the lobby phase

The hub scene and local avatar are already rendered (sub-tickets 01/02), but the
full-screen `#lobby` overlay paints an opaque `#0f172a` background over the
entire viewport (`position: fixed; inset: 0; z-index: 100`), so the player never
sees the hub or their avatar during `gamePhase === 'lobby'`. Change the lobby
presentation so the rendered hub canvas remains visible while the lobby panels
and controls stay usable.

Depends on sub-tickets 01 (server delivers `hubLayout`) and 02 (client renders
the hub + spawns the local avatar in lobby).

## Acceptance Criteria

- During `gamePhase === 'lobby'`, the rendered hub canvas (and the local
  avatar drawn in it) is visible to the player — it is NOT fully occluded by the
  `#lobby` overlay's background.
- The `#lobby` root no longer paints a fully opaque, viewport-filling background
  over the canvas. Its background is either removed/transparent or replaced with
  a translucent treatment so the canvas shows through; any decorative
  gradient/scanline layers are kept translucent (alpha < 1) and do not fully
  hide the canvas.
- All existing lobby controls remain present and interactive: the lobby tabs
  (Loadout Bay / Card Shop / Photon Forge / Card Economy / Medic / Key Items),
  the Deploy button (`#ready-btn`), Return to Registry (`#leave-lobby-btn`), the
  player list, and the quest board. Their containing panels keep a readable
  (e.g. translucent dark) background so text stays legible over the 3D canvas,
  and `pointer-events` remain active on the lobby controls.
- No regression to the existing dungeon/run view: when `gamePhase === 'playing'`
  the in-run HUD and canvas are unaffected by these style changes.
- No new console errors or page errors during the lobby phase.
- A Playwright browser smoke test drives register → join/create lobby → reach
  the lobby phase, and asserts the hub canvas is visible (e.g. the `<canvas>` is
  rendered and not covered by an opaque full-screen `#lobby` background — for
  example by checking the computed background of `#lobby` is transparent or that
  the canvas is the topmost element at a point away from the lobby panels) while
  the Deploy button remains clickable.

## Technical Specs

- `game/client/style.css`:
  - Change the `#lobby` rule (currently `position: fixed; inset: 0; z-index: 100`
    with a `background` stack ending in opaque `#0f172a`) so it no longer
    occludes the canvas. Prefer keeping `#lobby` as the positioned layout
    container but making its background transparent (or a low-alpha overlay),
    and instead apply the translucent dark backdrops to the individual lobby
    panels/wrappers (player list, quest board, tabs, editor/shop/forge/economy/
    medic/keyitems sections) so their content stays legible. Keep the canvas
    (`canvas { display:block }`, z-index 9/10 region) visible beneath.
  - Ensure the lobby content remains scrollable and laid out as today
    (`display:flex; flex-direction:column; overflow-y:auto`).
- `game/client/main.js` / `game/client/index.html`: only adjust if needed to
  toggle a body/`#lobby` state class for the lobby phase (e.g. so the
  translucent treatment only applies during `gamePhase === 'lobby'`); do NOT
  change the hub render/spawn logic from sub-ticket 02.
- `game/client/scripts/` — add a Playwright smoke test (e.g.
  `test-hub-lobby-visible.mjs`, modeled on `test-lobby-browser.mjs` /
  `test-world-stage-transition.mjs`) that registers, joins/creates a lobby,
  waits for the lobby phase, and asserts the hub canvas is visible (not covered
  by an opaque `#lobby` background) and the Deploy button is still interactive.
  Wire it into `game/package.json` scripts alongside the other
  `test:smoke:*` entries if appropriate.

## Verification: code
