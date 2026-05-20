# Ticket: Synergistic Cards (Resource & Charge Synergy)

> [!NOTE]
> **Staleness note.** This ticket was written against commit `5064d0c` (2026-05-19). The codebase may have moved on since it was filed — before acting, re-check every file path and code reference below against the CURRENT code, and skip any issue that is already resolved.

## Goal
Implement a set of highly interactive "synergistic cards" that focus on resource generation (Magic Stones) and usage restoration (replenishing charges of other cards) to enable deep, strategic deck-building combos and playstyles.

## Problem
Currently, card mechanics are largely self-contained. Adding cards that actively interact with the state of *other* cards in your hand or active summons opens up rich synergy potential and adds high-skill expression to deck management during runs.

---

## Proposed Cards

### 1. Mana Prism (Summon/Skill)
*   **Base Form**: Costs 1 charge. Spawns a glowing crystal at the player's cursor. Drains its own life/duration to pulse Magic Stones (+10 MS every 2 seconds for 12 seconds).
*   **Upgraded Form (Aether Crystal)**: The pulse rate is doubled, and it explodes upon expiration or destruction, yielding +50 MS instantly.

### 2. Harvesting Scythe (Weapon)
*   **Base Form**: Costs 1 charge. A sweeping melee weapon with low base damage, but grants +5 Magic Stones for every enemy hit, and +15 on kill.
*   **Upgraded Form (Soul Reaper)**: Increases sweep arc and grants double Magic Stones when striking enemies affected by status conditions (e.g., Frozen, Burning).

### 3. Sacrificial Altar (Summon/Skill)
*   **Base Form**: Costs 1 charge. Spawns a ritual circle. Consumes the oldest active summoned monster/minion inside the circle to instantly gain +100 Magic Stones and restore +2 charges to a random weapon card in your hand.
*   **Upgraded Form (Altar of Rebirth)**: The sacrifice is 100% efficient—restoring +3 charges to *all* cards in your hand, and transferring 50% of the sacrificed minion's remaining HP as a temporary shield to the player.

### 4. Battery Automaton (Monster)
*   **Base Form**: Costs 50 Magic Stones. Summons a slow, tanky mechanical helper. While active, it channels energy to the player, restoring +1 charge to a random card in hand every 6 seconds.
*   **Upgraded Form (Overcharged Dynamo)**: Charge restoration frequency is reduced to every 4 seconds. Additionally, when the Dynamo takes damage, it has a 20% chance to immediately restore +1 charge to the most-depleted card in your hand.

### 5. Chrono Trigger (Summon/Skill)
*   **Base Form**: Costs 1 charge. Instantly restores +2 charges to the two cards directly adjacent to it in the hand bar upon being played.
*   **Upgraded Form (Temporal Anchor)**: Restores +3 charges to adjacent cards. If played while adjacent to a fully depleted (0 charges) card, that card is immediately upgraded to its "Evolved" form for the duration of the current room.

---

## Brainstormed Synergies & Upgrade Reworks

### Combo A: "Necrotic Fuel Cycle"
*   **Synergy**: `Undead Commander` (Evolved Skeleton Knight) + `Sacrificial Altar` + `Soul Drain` (Evolved Mana Leach)
*   **How it works**:
    1. The player summons a horde of skeleton minions using `Undead Commander`.
    2. When the skeletons are heavily damaged or their lifetime is about to expire, the player drops `Sacrificial Altar` to consume them.
    3. This yields a massive influx of Magic Stones and completely refills the charges of `Soul Drain`.
    4. The player unleashes `Soul Drain` on the clustered enemies, healing themselves, dealing huge AoE damage, and using the high Magic Stone count to immediately spawn a fresh horde of skeleton minions.

### Combo B: "The Infinite Resonance Loop"
*   **Synergy**: `Resonance Edge` (Evolved Echo Blade) + `Battery Automaton` + `Temporal Anchor`
*   **How it works**:
    1. The player uses `Resonance Edge` to deliver rapid attacks, triggering shockwaves on every 3rd hit.
    2. `Battery Automaton` keeps replenishing the charges of `Resonance Edge` in hand.
    3. `Temporal Anchor` is played adjacent to `Resonance Edge` to elevate it into an temporary evolved state that makes the shockwaves also shock/stun enemies.
    4. By positioning the `Battery Automaton` near the player, the shockwaves strike nearby enemies, keeping the Automaton safe while creating a perpetual weapon-swinging loop that requires zero mana/gold upkeep.

### Combo C: "Supernova Shatter"
*   **Synergy**: `Event Horizon` (Evolved Gravity Well) + `Glacier Collapse` (Evolved Frost Nova) + `Soul Reaper`
*   **How it works**:
    1. `Event Horizon` is cast to vacuum all enemies in the room into a single high-density point.
    2. `Glacier Collapse` is instantly dropped on the center, freezing the entire packed cluster of enemies.
    3. The player rushes in with `Soul Reaper` (Evolved Harvesting Scythe).
    4. Since `Soul Reaper` yields double Magic Stones from status-afflicted (Frozen) targets and strikes everything in its wide sweep, a single swing through the cluster generates hundreds of Magic Stones in a split second, enabling massive late-game summon plays.

### Combo D: "Photonic Overdrive"
*   **Synergy**: `Excalibur Photon` (Evolved Saber of Light) + `Chrono Trigger`
*   **How it works**:
    1. `Excalibur Photon` possesses an extremely high attack speed but burns through its charges incredibly fast.
    2. By placing `Chrono Trigger` adjacent to `Excalibur Photon`, the player keeps the weapon continually topped off.
    3. **Rework Synergy Upgrade**: If `Excalibur Photon` reaches exactly 0 charges, instead of breaking/disappearing immediately, it triggers a "Photonic Overdrive" state for 3 seconds: the weapon has unlimited charges, +100% attack speed, and inflicts light damage, before finally depleting. This encourages high-risk, high-reward play by letting the player deliberately run their charges down to zero to burst bosses.

---

## Implementation Tasks
- [ ] **Data Model Support**: Update the card state structure to allow dynamic charge changes on other cards in the player's active hand.
- [ ] **Card Definitions**: Add `mana_prism`, `harvesting_scythe`, `sacrificial_altar`, `battery_automaton`, and `chrono_trigger` definitions to `game/client/cards.js` and `game/server/index.js`.
- [ ] **Magic Stone Integration**: Connect the Magic Stone yield from weapons/summons to the player's active resource bank in the server game loop.
- [ ] **UI Hand Indicator**: When hovering over cards like `Chrono Trigger` in the hand, highlight adjacent cards with a subtle glowing border to visually represent the synergy.
- [ ] **Sacrifice Mechanics**: Implement a way to select or target active friendly summons for cards like `Sacrificial Altar`.

## Verification Plan
1. **Adjacent Charge Replenishment**: Play `Chrono Trigger` adjacent to an `Iron Sword` with 1 charge. Verify the sword's charges immediately increase to 3.
2. **Resource Harvesting**: Strike 5 enemies with `Harvesting Scythe`. Verify that the Magic Stone count increases in real-time.
3. **Sacrifice Integration**: Summon a `Skeleton Knight`, then cast `Sacrificial Altar` on it. Verify the minion is destroyed, Magic Stones are gained, and hand charges are replenished.
