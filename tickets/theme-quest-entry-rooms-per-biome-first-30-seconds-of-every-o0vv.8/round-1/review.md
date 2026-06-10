# Senior Review — Theme quest entry rooms per biome

**Ticket:** Entry rooms for frost_crossing, ember_descent, and training_caverns should read as biome-specific on first deploy (palette + light dressing), without gameplay/collision changes.

**Baseline:** `a29edf0397c5f1c8a91bb0a37458e884df30ea1b`  
**Implementation commits:** 4 (`01-entry-palette-client-tinting` → `04-entry-distinguishability-tests`)

---

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json.ok` | `true` |
| `pageerrors` | `[]` (also empty in `pageerrors.json`) |
| `console.log` pageerrors / `[fatal]` | None — only Vite connect, a benign 409 on auth, `[initScene]`, and `[debugScenario] applied sunken-canyon-stage` |
| Servers started | Yes (client on `:5175`, gameplay probes show `phase: "playing"`, `sceneInitialized: true`) |

**Runtime verdict:** Game starts and loads cleanly. No browser page errors or fatal console failures.

---

## Per-criterion findings

### 1. Spawn rooms in frost_crossing, ember_descent, and training_caverns are visually distinguishable at a glance

**Met (code + tests; harness capture does not show this directly).**

The ticket was decomposed into four layers that integrate correctly:

| Layer | What shipped |
|-------|----------------|
| Theme (`dungeonTheme.json`) | Per-profile `entryFloor` / `entryWall` for `ice-cavern`, `fire-cavern`, and `crowded` |
| Client (`game/client/dungeon.js`) | `getEntryRoomMaterials()` cached palette; start rooms bypass generic green `roleTints.start`; `buildEntryDecorMesh()` renders icicles / ember vents / vault rubble |
| Server (`game/server/dungeon.js`) | Ice/fire start rooms tagged `band: 'entry'`; crowded start tagged `band: 'vault-entry'`; `scatterEntryDecor()` adds visual-only props in start rooms |
| Regression (`game/client/test/dungeon.test.js`) | `cross-quest entry room distinguishability (tier 1)` builds tier-1 layouts for all three quests via the real `questLayoutSeed` → `generateLayout` path, runs `buildDungeon`, and asserts three pairwise-distinct floor hex values, ≥2 distinct wall hex values, and quest-specific decor types |

Concrete palette separation (from tests):

- **frost_crossing** (`ice-cavern`): floor `0x4a6278`, wall `0xb8d4e8`, decor `icicle_cluster`
- **ember_descent** (`fire-cavern`): floor `0x2a1818`, wall `0xc45020`, decor `ember_vent`
- **training_caverns** (`crowded`): floor `0x1e2838`, wall `0x5a6a42`, decor `vault_rubble`

Fire-cavern integration is consistent end-to-end: rim spawn room uses `band: 'entry'` (was `rim`), `resolveFireCavernRoomMaterials` and `computeFireCavernAtmosphereBounds` now key off `role === 'start' || band === 'rim'`, and `buildEmberDescentTier1Script` finds the spawn room by `role === 'start'` instead of `band === 'rim'`.

**Harness capture gap (non-blocking):** Round-1 used the generic `fallback` capture plan (`sunken-canyon-stage` debug scenario) and does not include spawn-room screenshots for the three acceptance quests. PNG files referenced in `metrics.json` are not present under `round-1/`. Visual distinguishability is therefore proven by unit/integration tests and sub-ticket QA, not by top-level capture artifacts.

### 2. No gameplay / collision changes

**Met.**

- `entryDecor` is visual-only: `scatterEntryDecor` skips reachability and collision footprint checks; server test `entryDecor does not add cover colliders` and client test `buildWallColliders ignores entry decor` both assert `buildWallColliders(layout)` is unchanged with vs without decor.
- No changes to movement, spawn logic, enemy pools, or combat simulation beyond the ember script lookup switching from `band === 'rim'` to `role === 'start'` (equivalent after the band rename).
- Walkability / fire-cavern tests still pass; `fire_cavern_walkability.test.js` and `fire-atmosphere.test.js` were updated only for the start-room lookup change.

---

## Design & foundation consistency

- Aligns with `game/docs/design.md` quest-identity goal: tier-1 contracts should feel distinct from the first room.
- `decompose.txt` scope (ice / fire / crowded only) matches the ticket acceptance list; sunken-canyon and spire entry theming mentioned in the design blurb were intentionally deferred and are not acceptance blockers.
- No regressions observed against core dungeon generation, floor sampling, or lobby/deploy flow in harness probes or `coverage.log` (1737 server tests passed).

---

## Code quality

- Changes are focused, follow existing profile/band material patterns, and reuse cover-scatter margin/spawn-clear conventions for decor placement.
- Material caches (`entryRoomMaterialsCache`, band material caches) avoid per-frame allocation.
- Four logical commits with matching test coverage at each layer.
- No dead code or obvious bugs in the entry-room path.

This ticket did **not** add new `?debugScenario=` shortcuts.

---

## Test & coverage summary

- Harness `coverage.log`: **1737 / 1737** server tests passed.
- Targeted ticket test `cross-quest entry room distinguishability`: **pass**.
- Independent `pnpm test:quick` run: 3132 passed, 2 failed — failures are in unrelated `arena-trials-boss-low-hp` and `smoke_bomb` tests, not in entry-room code.

---

## Remaining gaps

None blocking. The implementation fully satisfies both acceptance criteria; runtime capture is healthy.

---

## Nits (non-blocking)

See `nits.md` for harness capture-plan and follow-up theming items.

VERDICT: PASS
