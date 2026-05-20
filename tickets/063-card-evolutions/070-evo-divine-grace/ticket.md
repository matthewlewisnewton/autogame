# Ticket: Evolution - Divine Grace

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Goal
Implement the evolved form of **Healing Font**: the **Divine Grace**.

## Requirements
- **Stats**: Inherit base stats from Healing Font but apply a significant buff (e.g., +50% damage).
- **Special Effect**: Also restores a small amount of Magic Stones.
- **Visuals**: Define a new icon and color theme for this card.
- **Recipe**: This card is obtained by evolving a `Healing Font +10`.

## Implementation Tasks
- [ ] Add `divine_grace` definition to `CARD_DEFS`.
- [ ] Implement the unique ability logic in the server-side `useCard` handler.
- [ ] Add visual feedback (particles/sound) for the new effect on the client.

## Verification Plan
1. Evolve a Healing Font into a Divine Grace.
2. Verify the special effect triggers correctly during gameplay.
