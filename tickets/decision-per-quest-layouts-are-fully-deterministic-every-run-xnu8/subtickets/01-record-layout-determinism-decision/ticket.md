# Record layout determinism decision (option b)

Playtesting showed `questLayoutSeed(questId, tier)` makes every run of a quest reuse the same map and objective coordinates. Record the chosen design: **deterministic quest geometry + per-run randomized objective placement** (option b from the parent ticket). This preserves authored room layouts and scripted wave anchors while fixing the memorize-the-checklist problem for `collect_items` quests like Prism Salvage.

## Acceptance Criteria

- `game/docs/design.md` has a **Layout & spawn determinism** (or similarly titled) section that explicitly chooses option (b): geometry is fixed per quest+tier; objective entity placement (e.g. prism/crystal positions) varies per fresh run.
- The section states that `questLayoutSeed` in `game/server/dungeon.js` remains the sole seed for `generateLayout` / room geometry and must not change per run.
- The section states that scripted encounter waves stay **room-anchored** (authored room roles / landmarks), not tied to absolute world coordinates that players memorize across runs.
- The section names `crystal_rescue` / Prism Salvage as the motivating example (identical prism spots every run before this change).
- No game logic files are modified in this sub-ticket — documentation only.

## Technical Specs

- **`game/docs/design.md`** — Add a concise subsection under the dungeon / procedural generation area (near **Floor Geometry** or **Quest identity**). Document:
  - PRO kept: route learning, speedrun consistency, scripted set pieces.
  - CON addressed: checklist replay for `collect_items`.
  - Split: `questLayoutSeed` → layout; per-run `runSpawnSeed` (to be introduced in sub-ticket 02) → objective loot placement.
  - Reference parent decision and commit `b4a5bb8` context (`questLayoutSeed`, `spawnCrystals` path) without duplicating implementation detail.

## Verification: code
