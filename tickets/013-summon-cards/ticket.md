# Summon Cards & Magic Stones

Implement single-use Summon cards — powerful area-of-effect attacks that consume
a large amount of a Magic Stones resource. Depends on 010 and 011.

## Acceptance Criteria
- Each player has a Magic Stones resource shown in the HUD; it starts at a
  maximum and regenerates slowly over time
- Summon cards have a large Magic Stones cost; using one without enough stones
  is rejected and the player gets clear feedback
- Using a Summon triggers a large AoE visual effect (e.g. a dragon's fire) and
  damages every enemy within its radius
- A Summon card is single-use — it is fully consumed when used
- Magic Stones totals and summon effects are server-authoritative and synced

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`,
  `game/client/index.html`, `game/client/style.css`, `game/client/cards.js`
- **Server**: track `magicStones` per player with regeneration in the game
  loop; validate cost on `useCard` for `summon`-type cards; resolve radial AoE
  damage against `gameState.enemies`.
- **Client**: a Magic Stones HUD element and the AoE effect rendering.
