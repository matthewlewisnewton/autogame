# Canvas click triggers a basic attack

Make a left-click on the game canvas perform the player's basic attack during a
run, so the "clicking the canvas produced nothing" gap is fixed. The click
routes through the existing card-attack path (`useCard`), which already emits
`useCard` to the server and renders attack VFX, enemy flash, and floating
damage numbers via `renderCardUsed` — so hit feedback comes for free.

## Acceptance Criteria

- Left-clicking the 3D canvas while `gamePhase === 'playing'` triggers the
  player's basic attack by invoking the existing `useCard(slotIndex)` flow on
  the first usable weapon-type hand slot (falling back to the first usable
  slot if no weapon is in hand).
- The attack emits the existing `useCard` socket event and, on a hit, the
  existing feedback fires (attack effect / enemy flash / floating damage
  number) with no new feedback code required — i.e. the basic attack reuses
  `useCard` rather than a separate emit.
- Clicking when not in the playing phase (lobby/overlays) does nothing.
- Clicks that originate on a HUD/UI element (card slots, buttons, overlays) are
  NOT also treated as a canvas basic-attack (no double-trigger). Right-click
  (camera orbit drag) is unaffected.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/client/main.js`: add a `pointerdown` (or `click`) listener on the
  renderer canvas (`getRenderer().domElement`, already imported as part of the
  renderer API; `renderer.domElement` is appended to `document.body` and its
  `pointerEvents` is set to `'auto'` only during `playing` — see
  `renderer.js:1179-1180,1306-1307`). Guard on `event.button === 0` and
  `gameState?.gamePhase === 'playing'`.
- Pick the basic-attack slot: iterate `hand` (imported from `./hand.js`) for the
  first slot where `canUseSlot(i)` is true and the card is a weapon
  (`card.type === 'weapon'`, i.e. not in `spellCardIds`/`creatureCardIds`/
  `enchantmentCardIds` from `./cards.js`); if none, use the first slot where
  `canUseSlot(i)` is true. Call the existing `useCard(slot)` (main.js:2844).
- Do not add server changes — `useCard` already sends `rotation` from
  `getPlayerFacingDirection()` and the server resolves the directional weapon
  hit.
- Reuse, do not duplicate, the existing hit-feedback path (`renderCardUsed`).

## Verification: code
