# Client booth interaction prompt & interact input

On the client, detect when the local player walks into a booth zone in the hub,
show an on-screen interaction prompt naming the booth, and bind an interact
key/click that emits `boothInteract`. Dispatch the resulting server `boothAction`
to a single hook point that future booths will subscribe to.

## Acceptance Criteria

- An `interact` input action exists with a default keyboard key (`f`) and an
  `onInteract` callback, wired through `initInput`. The interact key fires in the
  hub/lobby phase (it is NOT gated behind the dungeon `canUseGameActions` check
  the way hand slots / key-item are).
- While the local player stands within a booth zone in the hub, an interaction
  prompt element is shown that names the booth (e.g. "Press F — Shop"); it hides
  again when the player walks out of range or leaves the hub. Zone membership is
  computed with the shared `findBoothInRange(hubLayout.boothAnchors, x, z)` from
  `game/shared/boothZones.esm.js`.
- Pressing the interact key while in range, OR clicking the prompt, emits
  `boothInteract { boothId }` for the in-range booth. When no booth is in range,
  pressing interact emits nothing.
- A `boothAction` socket listener dispatches the named action to a single hook
  point (e.g. a `window` `CustomEvent('booth:action', { detail })` or a small
  registry function) so later booth tickets can attach behavior without
  re-touching this primitive. `boothError` is handled gracefully (no crash;
  prompt stays consistent).
- `pnpm test` passes, including a new client test covering prompt
  show-on-enter / hide-on-exit and that interact emits `boothInteract` with the
  correct id and dispatches `boothAction`.

## Technical Specs

- `game/client/input.js` — add `interact` to `ACTIONS` and a default binding
  `interact: ['f']` in `DEFAULT_KEYBOARD`; add an `onInteract` callback to the
  `initInput` opts and invoke it in `onKeyDown` BEFORE the
  `canUseGameActions` gate (so it works in the hub), guarded by `isTypingTarget`
  and `e.repeat` like the others. Keyboard is sufficient; a gamepad binding is
  optional.
- `game/client/renderer.js` — in `animate()`, when the rendered scene is the hub
  and `hubLayout.boothAnchors` exist, compute the in-range booth for the local
  player using `findBoothInRange` (imported from `../shared/boothZones.esm.js`,
  or re-exported via `client/collision.js` like `sampleFloorY`) against
  `myX` / `myZ`. Expose the current in-range boothId to `main.js` (a getter
  such as `getCurrentBoothInRange()` or a callback) and provide a helper that
  emits `socketRef.emit('boothInteract', { boothId })` for the current booth.
- `game/client/main.js` — pass `onInteract` to `initInput` (emit
  `boothInteract` for the current in-range booth, no-op when none); each frame /
  on update, show or hide the booth prompt based on the current in-range booth
  and update its label from a booth-id → display-name map (quest, launch, shop,
  deck, character, hats); add `socket.on('boothAction', ...)` that dispatches to
  the single hook point, and `socket.on('boothError', ...)` that logs/ignores.
- `game/client/index.html` — add a hidden `#booth-prompt` overlay element
  (clickable) for the prompt text.
- `game/client/style.css` — style `#booth-prompt` (HUD-style, hidden by
  default).
- New `game/client/test/boothPrompt.test.js` (vitest + jsdom, following
  `game/client/test/hub-lobby-render.test.js`) — assert prompt visibility
  toggles on zone enter/exit, the interact action emits `boothInteract` with the
  right id when in range and nothing when out of range, and a `boothAction`
  message triggers the dispatch hook.

## Verification: code
