# Loot Drops & Currency

Defeated enemies drop loot — currency that players collect — closing the
"Loot & Economy" part of the core loop in `game/docs/design.md`.

## Acceptance Criteria
- When an enemy is killed it has a chance to drop a loot item at its location
- Loot items are visible in the 3D world and are collected when a player moves
  over them
- Collecting currency increases that player's currency total, shown in the HUD
- Collected loot is removed and the removal is broadcast, so a loot item can
  never be collected twice

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`,
  `game/client/index.html`, `game/client/style.css`
- **Server**: on enemy death, roll for and spawn a loot entity; detect
  player-over-loot pickup collisions; track `currency` per player and broadcast
  loot spawn/pickup events.
- **Client**: render loot entities and a currency HUD element.
- **Depends on**: ticket 010 (enemies) and tickets 012–014 (a way to kill them).
