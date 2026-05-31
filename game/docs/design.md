# Game Design Document

## Overview
This game is a 3D multiplayer action-RPG that combines elements from *Phantasy Star Online Episodes I&II* and *Lost Kingdoms 1 & 2*. Players will gather in a lobby, join squads, and tackle semi-procedurally generated dungeons to defeat enemies and gather loot. Combat revolves around an active "deck" of cards rather than basic attacks.

## Core Loop
1. **Lobby browser**: After login, players see a list of open lobbies (name, player count, dungeon, in-run vs waiting). They create a new lobby or join an existing one. Lobbies mid-run support **drop-in** rejoin.
2. **Lobby**: Once in a squad, players manage decks, select quests, trade, and ready up. See [lobbies.md](./lobbies.md) for socket events, server architecture, and testing.
3. **Dungeon**: When all squad members are ready, players zone into a modularly generated level where they navigate rooms, defeat AI enemies, and complete objectives.
4. **Loot & Economy**: Enemies drop currency and new cards. Back in the lobby, players can trade or sell their loot to customize their combat decks.

### Floor Geometry
Dungeon rooms and passages may have sloped floors (ramps) with varying elevation across their vertices. The walkable surface height at any `(x, z)` coordinate is determined by `sampleFloorY()`, which interpolates across the room's floor corner positions. Each room carries a `floorCorners: { yNW, yNE, ySE, ySW }` object specifying the Y height at each corner; corners are labelled NW/NE/SE/SW relative to room center (NW = top-left, counter-clockwise). Player movement on slopes — adjusting `player.y` to follow the floor surface — is implemented in ticket 117. Floor sampling logic lives in `shared/floorSampling.esm.js`; see `shared/floorSampling.js` for the CJS eval-bridge.

## Run Suspend / Resume
Telepipe is a mid-run evacuation spell that lets a squad suspend a dungeon without losing the current run state.

- A player can place one shared Telepipe portal per run. The card is consumed, costs 0 Magic Stones, and creates a fixed portal at the caster's position.
- Each player enters the portal individually. Extracted players return to the lobby overlay, cannot use dungeon actions, and are ignored by combat simulation while remaining squadmates continue playing.
- The run only suspends when no active players remain in the dungeon. At that point the server captures a checkpoint with the run, layout, enemies, minions, loot, hands, objective progress, and portal position.
- When the squad Deploys again from the suspended lobby, the checkpoint is restored instead of generating a fresh layout, and the dungeon resumes with the preserved portal/enemy/loot state.
- Players can abandon a suspended run from the lobby, which clears the checkpoint and returns the squad to normal lobby flow.

## Combat Mechanics
Instead of standard weapons, players equip a deck of up to 12 cards. At any time, they hold a "hand" of up to 4 cards, each mapped to an input button.

### Card Types
- **Weapons**: Multi-charge directional attacks like sword slashes or projectiles. These cards have multiple charges before they are discarded from the hand.
- **Spells**: Single-use cards with an **instant** effect at cast time (radial AoE, heal, pull, freeze, etc.). Many cost Magic Stones.
- **Creatures**: Single-use cards that spawn a persistent battlefield ally (minion, helper, or utility construct) that fights or supports until it expires.
- **Enchantments**: Single-use cards that leave a **lingering** magical effect on the ground or on yourself. They trigger when a condition is met (enemy walks over a hazard, you take damage) or fade after a timeout.

### Playtesting Notes (Spell vs Weapon Overlap)
Several spell cards (e.g. Battle Familiar, Mana Leach) overlap mechanically with weapons: instant damage at a cost of Magic Stones rather than charges. With the clearer four-type system in place, evaluate after playtesting whether to merge overlapping spells into single-charge weapon variants or keep them for MS-economy variety. No cards have been removed yet — rename-first, cut-later.

## Future Mechanics
- **PvP Wager Battles**: In a later update, players will be able to challenge each other to PvP deck battles and wager their collected currency.
