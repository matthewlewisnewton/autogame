# Client: Phase Step ally targeting and highlight

When the local player has `phase_step` equipped, the client highlights the nearest
ally within range and passes that ally's id as `targetPlayerId` when the key item
is triggered, so the swap targets a clear, visible ally rather than relying solely
on server auto-selection. (The client code for this already exists in the working
tree from an earlier round; this sub-ticket re-verifies it now that the
`summon_recall` server test — sub-ticket 03 — no longer reds the local-checks gate.)

## Acceptance Criteria

- While in the dungeon (`gamePhase === 'playing'`) with `phase_step` equipped, the
  client computes the nearest living, non-extracted other player within 6m of the
  local player and renders a visible highlight (e.g. a ring/marker/outline) on that
  ally. When no ally is in range, no highlight is shown.
- Triggering the key item (the `onUseKeyItem` input handler) emits
  `useKeyItem` with `{ keyItemId: 'phase_step', targetPlayerId }` where
  `targetPlayerId` is the currently highlighted ally's id (omitted/null when none
  is in range, leaving the server to auto-select or fail gracefully).
- Highlight selection updates as players move (recomputed each frame/tick, not
  computed once).
- For non-`phase_step` key items, the `useKeyItem` emit and behaviour are unchanged
  (no `targetPlayerId` added, no highlight shown).
- The success VFX/indicator path for `keyItemUsed` continues to work; the new
  `phase_step` branch does not break the existing `field_medic_kit`/`guard_block`
  handling.
- `pnpm test` and local-checks return `rc: 0` (no server regression; relies on
  sub-ticket 03 having de-flaked the `summon_recall` test).

## Technical Specs

- `game/client/main.js`:
  - In the `onUseKeyItem` handler (~line 722) special-case `phase_step`: when the
    equipped item is `phase_step`, include the resolved `targetPlayerId` in the
    `socket.emit('useKeyItem', ...)` payload. Keep the existing payload shape for
    all other items.
  - Add per-frame logic (in the existing render/update loop where `gameState` and
    `myId` are available) to find the nearest other player within 6m and store its
    id so `onUseKeyItem` can read it. Range constant (6m) should match the server
    `phase_step` def.
  - Render the highlight via the renderer. Reuse an existing player-marker / lock-on
    style highlight if one exists (see lock-on handling and `renderer.js`); add a
    minimal ring/outline if none is reusable. Clear it when no ally is in range or
    when `phase_step` is not equipped.
- `game/client/renderer.js`: if a new visual is needed, add a small helper to
  show/hide an ally highlight marker at a player's position, following existing VFX
  helper patterns (e.g. the heal-pulse / shield VFX helpers already referenced from
  `main.js`).
- Do not change server code in this sub-ticket; rely on the `targetPlayerId`
  contract delivered by sub-ticket 01 and the green test gate from sub-ticket 03.

## Verification: code
