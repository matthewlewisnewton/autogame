# Boss-level quest kind and compact boss-arena layout

Introduce a reusable `levelKind: 'boss_level'` quest-tier marker (distinct from in-dungeon miniboss tiers) and a dedicated `boss-arena` layout profile: one compact walkable room with a center `arena_dais` landmark and minimal cover, suitable as the entire level for a single boss fight.

## Acceptance Criteria

- Quest tier defs may set `levelKind: 'boss_level'`. `getQuest()` surfaces the field on the resolved quest object.
- `isBossLevelQuest(quest)` (or equivalent exported helper in `quests.js`) returns true only when `quest.levelKind === 'boss_level'`.
- `getLayoutProfileForQuest(questId, tier)` returns `'boss-arena'` for boss-level tiers (either from an explicit `layoutProfile: 'boss-arena'` on the tier def or from a boss-level default when `levelKind` is set).
- `generateLayout(seed, 'boss-arena', options)` in `dungeon.js` returns a single-room layout: `rooms.length === 1`, `passages.length === 0`, `profile === 'boss-arena'`, and a landmark `{ type: 'arena_dais' }` at the arena center. Cover count is minimal (fewer pieces than `open-plaza`; no multi-room grid).
- Boss-level tier validation (in `quests.test.js` or a new `boss_level_schema.test.js`) rejects or documents required companion fields: boss levels must pair with `objectiveType: 'stage_boss'` and an `encounter` block (enforced at test time for any registered boss-level quest).
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/quests.js`** — Document `levelKind` on tier defs; add `isBossLevelQuest(quest)`; default boss-level `layoutProfile` to `'boss-arena'` inside `getLayoutProfileForQuest` when `levelKind === 'boss_level'` and no explicit profile is set; export the helper.
- **`game/server/dungeon.js`** — Add `BOSS_ARENA` tuning constants, `generateBossArena(seed, options)`, register `'boss-arena'` in `LAYOUT_PROFILES` and the `generateLayout()` early-return branch (mirror `open-plaza` pattern but smaller arena and sparser cover).
- **`game/server/test/boss_level_schema.test.js`** (new) — Assert helper behavior, layout shape/landmark, and `getLayoutProfileForQuest` for a synthetic boss-level fixture tier (may use an inline fixture object like existing escort/stage-boss fixtures, not necessarily a live `QUEST_DEFS` entry yet).
- **`game/server/test/dungeon.test.js`** or **`game/server/test/open_plaza.test.js`** — Extend with a `boss-arena` profile smoke case if a dedicated schema test does not cover layout generation.

## Verification: code
