# Current Gameplay: Combat, Dungeon & Economy

Extend `game/docs/gameplay-review.md` so **Current gameplay** also covers dungeon play, card combat, movement/targeting, enemies, loot, and co-op simulation—completing the inventory half of the parent ticket.

## Acceptance Criteria

- `game/docs/gameplay-review.md` is updated; still no changes under `game/server/` or `game/client/`.
- `## Current gameplay` now additionally describes (accurately, from code):
  - Deck size (up to 12), hand (up to 4 slots), card types (weapon charges vs spell/creature/enchantment single-use), Magic Stones, and passive hand refill if implemented.
  - Dungeon layout: procedural rooms/passages, sloped floors via `sampleFloorY` / `floorCorners`, wall collision and player movement tick.
  - Combat loop: enemy defs, attacks, player card plays, minions, enchantments, lock-on behavior (target-relative move, camera).
  - Key item (default dodge roll): cooldown, i-frames, direction from input.
  - Loot drops, pickup/magnet, currency, shop/trade hooks in lobby where relevant.
  - Co-op: shared run state, simulation tick per lobby, drop-in player init mid-run.
- At least **eight** references to real paths across server and client (e.g. `simulation.js`, `progression.js`, `hand.js`, `input.js`, `lockOn.js`, `dungeon.js`, `controls.md`, `shared/floorSampling.esm.js`).
- Section remains concise (roughly 400–900 words for the combat/dungeon portion); no placeholder bullets like “TBD”.
- **Improvements**, **Simplifications**, and **Prioritized shortlist** sections remain absent or clearly marked as coming later.

## Technical Specs

- **Edit only:** `game/docs/gameplay-review.md` (preserve and extend content from sub-ticket 01).
- **Read (do not edit):**
  - `game/docs/design.md`, `game/docs/controls.md`
  - `game/server/simulation.js`, `game/server/dungeon.js`, `game/server/progression.js`, `game/server/config.js`, `game/server/quests.js`
  - `game/shared/floorSampling.esm.js` (or `.js` bridge)
  - `game/client/input.js`, `game/client/hand.js`, `game/client/cards.js`, `game/client/lockOn.js`, `game/client/renderer.js`, `game/client/vanguard-hud.js`
- Use `CARD_DEFS` / handler names only when they map to player-visible behavior; avoid exhaustive card catalogs.

## Verification: code
