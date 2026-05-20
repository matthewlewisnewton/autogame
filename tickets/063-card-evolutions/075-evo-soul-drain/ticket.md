# Ticket: Evolution - Soul Drain

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Difficulty: easy

## Goal
Implement the evolved form of **Mana Leach**: the **Soul Drain**.

## Requirements
- **Stats**: Inherit base stats from Mana Leach but apply a significant buff (e.g., +50% damage).
- **Special Effect**: Also leaches a small amount of HP.
- **Visuals**: Define a new icon and color theme for this card.
- **Recipe**: This card is obtained by evolving a `Mana Leach +10`.

## Implementation Tasks
- [ ] Add `soul_drain` definition to `CARD_DEFS`.
- [ ] Implement the unique ability logic in the server-side `useCard` handler.
- [ ] Add visual feedback (particles/sound) for the new effect on the client.

## Verification Plan
1. Evolve a Mana Leach into a Soul Drain.
2. Verify the special effect triggers correctly during gameplay.
