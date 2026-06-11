# Deck Sifter: sync cast VFX origin to the draw resolution

The Deck Sifter `draw_card` effect is the only `CARD_USED` emit that omits an
`origin`, so the client renders the card's particle burst at world `(0,0)`
instead of at the caster. Add the caster origin to the emit so the animation
fires at the player's position, in sync with the server-side draw resolution.

## Acceptance Criteria
- The `draw_card` branch's `CARD_USED` emission includes
  `origin: { x: originX, z: originZ }` (the caster's locked cast position),
  matching the shape every other `CARD_USED` emit in the file already uses.
- The origin values are the same `originX`/`originZ` already computed earlier in
  `resolvePendingCardUse` for this cast (no recomputation, no new fields beyond
  `origin`).
- No change to draw behaviour: a card is still drawn, a charge is still spent,
  the slot still exhausts at 0 charges, and `STATE_UPDATE` still emits before
  `CARD_USED`.
- A server test asserts the `deck_sifter` / `draw_card` `CARD_USED` payload
  carries a finite `origin.x` / `origin.z` equal to the caster's position.

## Technical Specs
- `game/server/cardEffects.js`: in the `cardDef.effect === 'draw_card'` branch
  of `resolvePendingCardUse` (the `io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, …)`
  near line 365), add `origin: { x: originX, z: originZ }` to the emitted object.
  `originX`/`originZ` are already in scope from the top of the function.
- `game/server/test/` (e.g. `server.test.js` or a card-effects test): add/extend
  a case that drives a `deck_sifter` use and asserts the captured `CARD_USED`
  payload includes `origin.x`/`origin.z` matching the caster.

## Verification: code
