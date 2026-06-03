# Expose current stage/layout summary in the harness state hook

The QA harness state hook (`window.__AUTOGAME_HARNESS_STATE__()`) currently exposes
the player position and phase but nothing identifying which world stage / layout is
loaded. A world-stage portal transition cannot be confirmed in code without a stable,
machine-readable signal of "which stage am I on and where is its start room". Add a
`layout` summary to the harness state so a transition between stages is observable.

## Acceptance Criteria

- `window.__AUTOGAME_HARNESS_STATE__()` returns a new `layout` field (or `null` when no
  layout is loaded yet, e.g. in the lobby) summarizing the currently loaded dungeon
  layout from the client's `gameState.layout` / `currentLayout`.
- The `layout` summary includes at minimum:
  - `profile` — the layout/stage identifier string (e.g. `'crowded'`, `'sunken-canyon'`,
    `'spire-ascent'`, `'open-plaza'`), read from `layout.profile`.
  - `seed` — the current layout seed (`currentLayoutSeed`, may be `null`).
  - `roomCount` — number of rooms in `layout.rooms`.
  - `startRoom` — `{ x, z, role }` of the room whose `role === 'start'` (or `null` if
    none), so the player's post-transition placement can be checked against it.
- The field reflects the live layout: after a `questUpdate` swaps the layout (e.g. via the
  `sunken-canyon-stage` debug scenario), a subsequent call returns the new `profile`,
  `roomCount`, and `startRoom`.
- No existing harness-state fields are removed or renamed; existing client/server tests
  still pass and the game loads cleanly.

## Technical Specs

- `game/client/main.js`: in the `window.__AUTOGAME_HARNESS_STATE__ = () => {...}` object
  (around line 3797), add a `layout` property. Source it from the existing module-scoped
  `currentLayout` (and `currentLayoutSeed`) / `gameState.layout` already maintained by the
  `questUpdate` / `stateUpdate` handlers (see lines ~582, ~1477–1484). Build the summary
  defensively: return `null` when no layout is present, and guard `rooms` being missing.
- Do not change server code or the debug-scenario handlers; this is purely a read-only
  exposure of state the client already holds.

## Verification: code
