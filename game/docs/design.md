# Game Design Document

## Overview
This game is a 3D multiplayer action-RPG that combines elements from *Phantasy Star Online Episodes I&II* and *Lost Kingdoms 1 & 2*. Players will gather in a lobby, join squads, and tackle semi-procedurally generated dungeons to defeat enemies and gather loot. Combat revolves around an active "deck" of cards rather than basic attacks.

## Core Loop
1. **Lobby**: A central hub where players can chat, form groups, and manage their decks.
2. **Dungeon**: Once a squad is formed, players zone into a modularly generated level where they navigate rooms, defeat AI enemies, and complete objectives.
3. **Loot & Economy**: Enemies drop currency and new cards. Back in the lobby, players can trade or sell their loot to customize their combat decks.

## Combat Mechanics
Instead of standard weapons, players equip a deck of up to 30 cards. At any time, they hold a "hand" of up to 4 cards, each mapped to an input button. 

### Card Types
- **Summons**: Single-use cards that initiate a massive area-of-effect attack (e.g., a dragon breathing fire) and consume a large amount of resources (Magic Stones).
- **Multi-use / Weapon Cards**: Smaller, faster attacks like sword slashes or projectiles. These cards have multiple charges before they are discarded from the hand.
- **Independent Monsters**: Summons an AI-controlled minion that roams the battlefield and attacks enemies autonomously until its health or duration expires.

## Future Mechanics
- **PvP Wager Battles**: In a later update, players will be able to challenge each other to PvP deck battles and wager their collected currency.
