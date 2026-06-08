# Game Design Document

## Overview
This game is a 3D multiplayer action-RPG that combines elements from *Phantasy Star Online Episodes I&II* and *Lost Kingdoms 1 & 2*. Players will gather in a lobby, join squads, and tackle semi-procedurally generated dungeons to defeat enemies and gather loot. Combat revolves around an active "deck" of cards rather than basic attacks.

## Core Loop
1. **Lobby browser**: After login, players see a list of open lobbies (name, player count, dungeon, in-run vs waiting). They create a new lobby or join an existing one. Lobbies mid-run support **drop-in** rejoin.
2. **Lobby**: Once in a squad, players manage decks, select quests, trade, and ready up. See [lobbies.md](./lobbies.md) for socket events, server architecture, and testing.
3. **Dungeon**: When all squad members are ready, players zone into a modularly generated level where they navigate rooms, defeat AI enemies, and complete objectives.
4. **Loot & Economy**: Enemies drop currency and new cards. Back in the lobby, players can trade or sell their loot to customize their combat decks.

### Floor Geometry
Dungeon rooms and passages may have sloped floors (ramps) with varying elevation across their vertices. The walkable surface height at any `(x, z)` coordinate is determined by `sampleFloorY()`, which interpolates across the room's floor corner positions. Each room carries a `floorCorners: { yNW, yNE, ySE, ySW }` object specifying the Y height at each corner; corners are labelled NW/NE/SE/SW relative to room center (NW = top-left, counter-clockwise). Player movement on slopes — adjusting `player.y` to follow the floor surface — is implemented on the server in `applyPlayerMovement` (`game/server/simulation.js`), which snaps `player.y` via `sampleFloorY(_gameState.layout, x, z)`. Floor sampling logic lives in `shared/floorSampling.esm.js`; see `shared/floorSampling.js` for the CJS eval-bridge.

## Stage Bosses

Each stage culminates in a single stage boss (`ENEMY_DEFS` in `game/server/simulation.js`). Their base HP values are deliberately kept in a tight band so that a full-HP boss can be brought to 0 within the 180s `defeatBoss` validation window at the driver's attack DPS:

| Boss | Stage | Base HP |
| --- | --- | --- |
| `miniboss` (Vault Warden) | vault | 300 |
| `annex_overseer` (Annex Overseer) | annex | 320 |
| `spire_warden` (Summit Warden) | spire summit | 420 |
| `arena_champion` (Plaza Sovereign) | open plaza | 420 |

`arena_champion` was previously the outlier at **500 HP** — markedly above every other stage boss. At the driver's sustained attack DPS, 500 HP could not be reduced to 0 inside the 180s `defeatBoss` timeout (even in god-mode), which made the open-plaza validation flaky. It was retuned to **420**, aligning it with `spire_warden` (the next-highest boss) so a real, full-HP defeat is achievable within the window while the open plaza stays the joint-toughest encounter. Only `hp` changed; the boss's identity and pressure profile (higher `attackDamage` 26, widest cone `2π/3`, longest `attackRange` 6.5) are unchanged, so it remains the hardest-hitting, farthest-reaching stage boss.

## Telepipe Evacuation
Telepipe is a mid-run evacuation spell that lets squad members leave the dungeon early and return to the hub.

- A player can place one shared Telepipe portal per run. The card is consumed, costs 0 Magic Stones, and creates a fixed portal at the caster's position.
- Each player enters the portal individually (auto-enter when within range). Extracted players return to the hub lobby overlay, cannot use dungeon actions, and are ignored by combat simulation while remaining squadmates continue playing.
- While any squadmate remains active in the dungeon, the run stays `playing`. When the **last active player** extracts, the run is **suspended** to the hub: `captureRunCheckpoint()` saves layout, enemies, loot, objective progress, telepipe position, and per-player combat snapshots (including **card charge state**) into `suspendedCheckpoint`; transient world state is cleared and `gamePhase` returns to lobby. The client shows a **Resume expedition** banner and re-enables Deploy.
- **Resume:** When all squad members ready and Deploy, `checkAllReady()` detects `suspendedCheckpoint` and calls `restoreRunCheckpoint()` instead of generating a fresh dungeon. The squad re-enters the **same run id** with checkpoint layout, enemies, objective progress, and **card charges restored** to their pre-suspend values.
- **New sortie:** **Abort Sortie** in the hub UI (`abandonRun` socket → `abandonSuspendedRun()`) discards the suspended checkpoint and returns the squad to a normal waiting lobby. Deploying again (or starting a fresh quest when no checkpoint exists) starts a **new run** with a new layout, enemies, and run id; hands are re-dealt from deck loadouts and **card charges reset** to full.
- **Durability across telepipe suspend/resume and new sortie** (ticket 287 baseline; card charges per ticket 289):
  - **HP:** Persists across telepipe-resume **and** new sortie; restored at the hub **Medic station** or by **healing cards** (healing_font, divine_grace, soul_drain, Field Medic Kit, purifying_pulse) during combat — no automatic free heal at level start.
  - **Magic stones:** Persist across telepipe-resume **and** new sortie.
  - **Card charges:** **Persist** on telepipe-resume; **reset** on new sortie.

## Combat Mechanics
Instead of standard weapons, players equip a lobby loadout of 4–24 cards (the default starter deck has 12). During a run they have six hand slots; four cards are dealt into those slots at run open (the opening hand), and each occupied slot maps to an input button.

### Card Types
- **Weapons**: Multi-charge directional attacks like sword slashes or projectiles. These cards have multiple charges before they are discarded from the hand.
- **Spells**: Single-use cards with an **instant** effect at cast time (radial AoE, heal, pull, freeze, etc.). Many cost Magic Stones.
- **Creatures**: Single-use cards that spawn a persistent battlefield ally (minion, helper, or utility construct) that fights or supports until it expires.
- **Enchantments**: Single-use cards that leave a **lingering** magical effect on the ground or on yourself. They trigger when a condition is met (enemy walks over a hazard, you take damage) or fade after a timeout.

### Playtesting Notes (Spell vs Weapon Overlap)
Several spell cards (e.g. Signal Familiar, Mana Leach) overlap mechanically with weapons: instant damage at a cost of Magic Stones rather than charges. With the clearer four-type system in place, evaluate after playtesting whether to merge overlapping spells into single-charge weapon variants or keep them for MS-economy variety. No cards have been removed yet — rename-first, cut-later.

## Future Mechanics
- **PvP Wager Battles**: In a later update, players will be able to challenge each other to PvP deck battles and wager their collected currency.
