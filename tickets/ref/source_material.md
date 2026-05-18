# Source Material Reference

Visual and mechanical reference for the two GameCube games this project draws from.

## Lost Kingdoms II (GameCube, 2003, FromSoftware)

### Screenshot References
Search these terms on Google Images to find the exact reference screenshots:
- `Lost Kingdoms 2 gameplay HUD cards` — Shows the in-game HUD with the 4-card hand
- `Lost Kingdoms 2 deck building screen` — Shows the deck management menu
- `Lost Kingdoms 2 summon card attack` — Shows a summon card being activated
- `Lost Kingdoms 2 independent monster` — Shows an autonomous creature fighting

### HUD Layout (from research)
```
┌─────────────────────────────────────────────────────────────┐
│ [Portrait]  HP: 185/210                                     │
│ [Lvl 12]    ████████░░                                      │
│             Magic Stones: 💎 34                              │
│                                                             │
│                                                             │
│              (3D dungeon environment)                        │
│                                                             │
│                                                             │
│                                                             │
│ ┌──┐┌──┐┌──┐┌──┐                     ┌────┐┌────┐┌────┐┌────┐│
│ │Q1││Q2││Q3││Q4│  (next cards)       │ A  ││ B  ││ X  ││ Y  ││
│ └──┘└──┘└──┘└──┘                     │card││card││card││card││
│  NEXT CARDS                          └────┘└────┘└────┘└────┘│
│                                       ACTIVE HAND (4 cards)  │
└─────────────────────────────────────────────────────────────┘
```

### Card Types (Detailed)
| Type | Uses | Behavior | Example |
|------|------|----------|---------|
| **Weapon** | Multi-use (3-5 charges) | Instant attack from player position (sword slash, beam) | Sword swipe in front |
| **Summon** | Single-use | Cutscene attack, massive AOE damage, 2 move choices in LK2 | Dragon fire breath |
| **Independent** | Duration-based | AI creature roams and fights autonomously, lifespan ticks down | Wolf that hunts enemies |
| **Helper** | Duration-based | Utility creature (decoy, buff, debuff) | Shield fairy |
| **Transform** | Duration-based | Player morphs INTO the creature, controls it directly | Become a phoenix |

### Resource System
- **Magic Stones**: Earned by hitting/killing enemies. Every card costs stones. If you don't have enough, **the cost comes from your HP**.
- **Elements**: Fire > Wood > Earth > Water > Fire. Neutral and Mechanical are unaffected.
- **Affinity**: Using one element raises its affinity but lowers the opposing element's affinity, increasing that element's cost.
- **Z-Charge**: Hold Z to double a card's power at double cost. Doubles duration for Independent/Transform.

---

## Phantasy Star Online Episodes I & II (GameCube, 2003, Sega)

### Screenshot References
Search these terms on Google Images:
- `Phantasy Star Online GameCube Pioneer 2 lobby` — The circular space station lobby
- `Phantasy Star Online GameCube forest dungeon` — A dungeon run in the Forest area
- `Phantasy Star Online item drop boxes` — Color-coded loot boxes
- `Phantasy Star Online shop tekker` — The NPC shop / item identification

### Lobby System
- **Pioneer 2**: A space station hub. Players gather here between missions.
- **Features**: Chat with text/symbol chat, trade items, form parties (up to 4 players), view Guild Cards, access shops and bank storage.
- **Flow**: Lobby → Form Party → Select Mission → Teleport to Dungeon → Clear → Return to Lobby

### Dungeon Generation
- **Block-based**: Pre-authored room/corridor segments are randomly assembled using a seed.
- **Connectivity**: A spanning-tree algorithm ensures all rooms are reachable.
- **Areas**: Forest, Caves, Mines, Ruins — each with distinct enemy types and aesthetics.
- **Difficulties**: Normal → Hard → Very Hard → Ultimate (scales enemy stats and loot quality).

### Loot System
| Box Color | Contents |
|-----------|----------|
| 🟠 Orange | Weapons (common) |
| 🔵 Blue | Armor, shields, units |
| 🟢 Green | Consumables, technique disks |
| 🔴 Red | Rare weapons, Photon Drops |

- **Section ID**: Character name determines drop tables. Encourages trading between players.
- **Tekker**: Unidentified "???" items must be appraised at the shop before use.
- **Bank**: Stores items and currency (Meseta) between runs.
- **Trading**: Direct player-to-player trade with item inspection.
