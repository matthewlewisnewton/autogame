# Booth-zone proximity primitive & server interact handler

Add a shared proximity-detection primitive that maps a player position to the
booth anchor they are standing in, plus an authoritative server `boothInteract`
socket handler that validates proximity against the hub's `boothAnchors` and
emits a named `boothAction` event. This is the foundation every booth builds on.

## Acceptance Criteria

- A shared function `findBoothInRange(boothAnchors, x, z, radius?)` returns the
  id of the nearest booth anchor whose center is within `radius` of `(x, z)`,
  or `null` when none are in range. Defaults to an exported
  `BOOTH_INTERACT_RADIUS` constant when `radius` is omitted.
- The shared primitive is consumable from both the server (CommonJS `require`)
  and the client (ESM `import`), mirroring the existing `floorSampling`
  dual-file pattern.
- A `boothInteract` socket handler exists. On `{ boothId }` it reads the
  player's authoritative position from lobby state, confirms (via
  `findBoothInRange` against the hub `boothAnchors`) the player is actually in
  range of the requested `boothId`, and only then emits `boothAction`
  `{ boothId, action: boothId }` back to that socket.
- When the player is out of range, the requested booth id is unknown/missing, or
  the socket is not in a lobby, the handler emits `boothError { reason }` and
  does NOT emit `boothAction`.
- Tests cover: zone enter (position inside a booth radius returns that booth id),
  zone exit / outside (position beyond radius and a position equidistant
  between booths return `null` or the correct nearest booth), and action
  dispatch (handler emits `boothAction` with the correct id when in range, and
  `boothError` when out of range or not in a lobby).
- `pnpm test` (server vitest) passes.

## Technical Specs

- New `game/shared/boothZones.esm.js` — ESM source of truth. Export
  `BOOTH_INTERACT_RADIUS` (a sensible value, e.g. `2.5`, comfortably smaller
  than `HUB_ANCHOR_INSET = 4` so adjacent booths in the same room don't both
  trigger) and `findBoothInRange(boothAnchors, x, z, radius = BOOTH_INTERACT_RADIUS)`.
  `boothAnchors` is the `{ booth: { x, z }, ... }` object produced by
  `generateHub` in `game/server/dungeon.js`. Iterate entries, compute planar
  distance (`Math.hypot(dx, dz)`), return the id with the smallest distance that
  is `<= radius`, else `null`.
- New `game/shared/boothZones.js` — CommonJS bridge that re-exports the same
  `findBoothInRange` and `BOOTH_INTERACT_RADIUS`, following the exact pattern of
  `game/shared/floorSampling.js` (CJS) vs `game/shared/floorSampling.esm.js`
  (ESM) so server `require('../shared/boothZones.js')` and the duplicated logic
  stay in sync.
- `game/server/socketHandlers/lobbyHandlers.js` — register
  `socket.on('boothInteract', (data) => { ... })` alongside the existing
  `move` handler. Use `withLobbyFromSocket`/`withLobbyPlayer` to obtain
  `state` + `player`; require lobby phase (`isLobbyPhase`). Validate
  `data.boothId` is a known anchor key. Source the hub `boothAnchors` from the
  generated hub layout (the `HUB_LAYOUT` already built in
  `game/server/index.js` / `progression.js` via `generateHub(0)`, threaded
  through `ctx` if needed — do not regenerate per call). Read `player.x` /
  `player.z`; call `findBoothInRange`. Emit `boothAction { boothId, action: boothId }`
  on success, else `boothError { reason }`.
- New `game/server/test/boothZones.test.js` — unit tests for `findBoothInRange`
  (enter/exit/nearest) against a `generateHub(0)` layout's `boothAnchors`, plus
  handler-level tests for `boothInteract` dispatch and rejection (reuse
  `connectClient` / lobby helpers from `game/server/test/helpers.js`; an
  integration-style test in `game/server/test/integration.test.js` is also
  acceptable).

## Verification: code
