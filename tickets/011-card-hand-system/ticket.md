# Card Hand System

Turn the 4 static HUD card slots from ticket 006 into a functional hand: the
player holds 4 cards, each bound to an input, and can "use" them. This ticket
wires up the hand UI and input — the actual attack effects come in 012–014.

## Acceptance Criteria
- The player holds a hand of 4 cards; each of the 4 HUD slots shows its card's
  name and a colour/icon indicating the card type
- Pressing keys 1–4 (or clicking a slot) "uses" the corresponding card
- Using a card plays a visible activation effect on that slot (flash + brief
  cooldown state)
- Multi-use cards show a charge count; each use decrements it, and at 0 charges
  the card is replaced in the slot by the next card from the deck
- Card definitions live in a shared data module so new card types can be added

## Technical Specs
- **Files**: new `game/client/cards.js`, `game/client/main.js`,
  `game/client/style.css`
- **Card data**: definitions `{ id, name, type, charges }` where `type` is one
  of `weapon` / `summon` / `monster` (see `game/docs/design.md`)
- **Client**: hand state, key 1–4 + click handlers, and rendering that updates
  the ticket-006 HUD slots. Emit a `useCard` event to the server (handlers for
  it are added by tickets 012–014).
