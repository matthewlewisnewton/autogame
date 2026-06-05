# 02 — Rigid layout generation mode

Introduce a reusable `layoutMode: 'rigid'` option for dungeon generation that reduces RNG-driven scatter (fixed cover/hazard placement from the candidate pool) while keeping the default mode unchanged for Tier-1 runs.

## Acceptance Criteria

- `generateLayout(seed, profile, options)` accepts `layoutMode` (`'default'` | `'rigid'`); unknown values fall back to `'default'`.
- For `open-plaza`, `'rigid'` skips shuffled scatter and places a deterministic, seed-stable cover/hazard set (same seed ⇒ identical `cover`/`hazards` arrays); `'default'` preserves current randomized scatter behavior.
- Two different seeds in `'default'` mode can still produce different cover counts/positions; `'rigid'` layouts for different seeds are identical or differ only in explicitly seed-driven cosmetic fields documented in code (not random subset selection).
- `getLayoutGenerationOptions(questId, tier)` (or equivalent in `quests.js`) returns `{ slopes: true, layoutMode }` from the quest tier definition, defaulting to `'default'` when omitted.
- `applyLayoutForQuest` uses that helper instead of hard-coding `{ slopes: true }` only.
- Unit tests in `game/server/test/dungeon.test.js` (or a focused new file) prove rigid vs default divergence and rigid determinism for `generateLayout(seed, 'open-plaza', { layoutMode: 'rigid' })`.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`** — Thread `layoutMode` through `generateLayout` → `generateOpenPlaza`; add a rigid placement path (e.g. ordered candidate acceptance without Fisher–Yates shuffle, fixed hazard positions). Export any small helper needed for tests.
- **`game/server/quests.js`** — Add `getLayoutGenerationOptions(questId, tier)` reading optional `layoutMode` on tier defs (default `'default'`).
- **`game/server/index.js`** — Update `applyLayoutForQuest` to call `generateLayout(seed, profile, getLayoutGenerationOptions(questId, normalizedTier))`.
- **`game/server/test/dungeon.test.js`** — New `open-plaza` rigid-mode cases: determinism, structural equality across seeds, and proof that default mode still varies with seed.
- Do **not** add `arena_trials` Tier 2 catalog content here (that is sub-ticket 03).

## Verification: code
