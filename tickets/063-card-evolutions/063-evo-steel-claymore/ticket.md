# Ticket: Evolution - Steel Claymore

> [!NOTE]
> **Staleness note.** This ticket was written against commit `70123f1` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Goal
Implement the evolved form of **Iron Sword**: the **Steel Claymore**.

## Requirements
- **Stats**: Inherit base stats from Iron Sword but apply a significant buff (e.g., +50% damage).
- **Special Effect**: Increased range and heavy knockback.
- **Visuals**: Define a new icon and color theme for this card.
- **Recipe**: This card is obtained by evolving a `Iron Sword +10`.

## Implementation Tasks
- [ ] Add `steel_claymore` definition to `CARD_DEFS`.
- [ ] Implement the unique ability logic in the server-side `useCard` handler.
- [ ] Add visual feedback (particles/sound) for the new effect on the client.

## Verification Plan
1. Evolve a Iron Sword into a Steel Claymore.
2. Verify the special effect triggers correctly during gameplay.
