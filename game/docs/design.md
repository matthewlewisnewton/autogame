# Game Design Document

## Overview
This game is a 3D multiplayer action-RPG that combines elements from *Phantasy Star Online Episodes I&II* and *Lost Kingdoms 1 & 2*. Players will gather in a lobby, join squads, and tackle semi-procedurally generated dungeons to defeat enemies and gather loot. Combat revolves around an active "deck" of cards rather than basic attacks.

## Core Loop
1. **Lobby**: A central hub where players can chat, form groups, and manage their decks.
2. **Dungeon**: Once a squad is formed, players zone into a modularly generated level where they navigate rooms, defeat AI enemies, and complete objectives.
3. **Loot & Economy**: Enemies drop currency and new cards. Back in the lobby, players can trade or sell their loot to customize their combat decks.

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
