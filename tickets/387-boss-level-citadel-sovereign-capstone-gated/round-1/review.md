# Senior Review — 387 Boss Level: Citadel Sovereign Capstone (gated)

## Runtime health (blocking pre-check)
PASS. `metrics.json` reports `"ok": true`, the dev servers started, and
`pageerrors` is `[]`. `console.log` contains only two benign `409 (Conflict)`
resource lines (account-file write race in the harness fixture) — no `pageerror`
or `[fatal]` lines from game code. The game starts and loads cleanly.

Note on capture coverage: the capture plan fell back to the deterministic
full-flow smoke (`capturePlanSource: "fallback"`), so the captured run exercised
`training_caverns`, not the citadel arena. That is a harness capture-plan choice,
not a code defect — the proof of a clean start still holds. The citadel content
itself is verified below via the live code and its (passing) unit/e2e suites.

## Acceptance criteria

The ticket goal decomposes into: dedicated capstone boss arena; gated behind a
multi-stage Tier-II AND combination; Citadel Sovereign boss; hardest level
overall; built on the 385 boss-level framework; shown on the level map.

### 1. Dedicated capstone boss arena — MET
`citadel_assault` Tier 1 is `objectiveType: 'stage_boss'`,
`levelKind: 'boss_level'`, `layoutProfile: 'boss-arena'` (quests.js). The e2e
confirms `state.layout.profile === 'boss-arena'` and a single arena room with an
`arena_dais` landmark. It reuses `generateBossArena`, not a bespoke layout.

### 2. Gated behind a Tier-II combination — MET
`unlockRequires` is the array form
`[{canyon_descent,2}, {spire_ascent,2}, {arena_trials,2}]`, normalized by the
existing `normalizeUnlockRequires` path (already used by `rift_convergence`).
`citadel_capstone_quest.test.js` and `citadel_capstone_e2e.test.js` assert the
node stays locked with two prereqs and unlocks only with all three
(`isQuestTierUnlocked(twoPrereqAccountId,...) === false`, all-three `=== true`).
True three-way AND gate.

### 3. Citadel Sovereign boss — MET
`citadel_sovereign` added to `ENEMY_DEFS` with full stat block, drops, and
display catalog entry. The boss spawns dormant on the dais, is invulnerable
while dormant (`canDamageEnemy === false`), and only activates after the five
supports are cleared — correct boss-level framework behavior.

### 4. Hardest level overall — MET, and enforced by tests
- `attackDamage: 30` — `citadel_sovereign.test.js` asserts it **strictly
  exceeds every other enemy's** attackDamage (30 vs colossus 28). Hardest-hitting
  boss in the game.
- `hp: 460` — ties the `riftbound_colossus` ceiling. The cap is deliberate and
  documented: design.md records that >460 HP cannot be defeated inside the 180s
  `defeatBoss` window. Correct call to tie rather than exceed it.
- `addCount: 5` — strictly more than rift_convergence's 4 (most adds of any
  boss); `burnDurationMs: 3500` (longest); `rewardCurrency: 26` (highest purse,
  vs 22). design.md and the rift_convergence briefing were updated for
  consistency.

### 5. Built on the 385 boss-level framework — MET
Uses `encounter` with `bossType`/`landmark`/`addCount`, the dormant→active→
cleared phase machine, encounter lock, and `finishStageBossDebugScenario`. No
parallel boss logic was introduced. The e2e walks the full lifecycle through to
`isRunObjectiveComplete` and the `rewardCurrency` payout.

### 6. Shows on the level map — MET
The unlock graph builders iterate `Object.keys(QUEST_DEFS)` (quests.js
~1801/1854), so `citadel_assault` is automatically surfaced with its normalized
`unlockRequires` edges. The `citadel-unlocked` / `citadel-one-prereq` debug
scenarios return a `levelUnlockGraph` payload exercising exactly this.

### 7. Arena theme + boss visuals — MET (cosmetic, no regressions)
Server emits `citadel_rampart_ring` / `citadel_banner_band` floor decals only
(no walls/cover) bounded inside the arena; client renders them plus the unique
crowned-cylinder `citadel_sovereign` silhouette and a gold radial attack
telegraph. `citadel_arena.test.js` and `renderer-citadel-sovereign.test.js`
cover both. Distinct from the rift theme.

## Debug scenarios (gating audit)
Three scenarios added: `citadel-boss`, `citadel-unlocked`, `citadel-one-prereq`.
- Gated: all three are registered in `DEBUG_SCENARIOS` and reachable only via
  the debug path; `citadel-boss` is also in
  `DEBUG_SCENARIOS_WITHOUT_DEFAULT_SPAWN`. The `?debugScenario=` URL is the only
  entry point. Normal gameplay does not touch them.
- Normal path still reachable: each scenario reaches its end-state by calling
  the *real* primitives — `completeQuestTier(...)` for the actual prereqs,
  `applyLayoutForQuest`, and `deployQuestDebugRun`/`finishStageBossDebugScenario`
  — i.e. the same path a real player hits after clearing all three Tier-II
  lines and deploying. The `citadel_capstone_e2e.test.js` lifecycle test proves
  the equivalent state is reachable through normal unlock + run flow.
- No invariants bypassed: the boss stays dormant/invulnerable until adds are
  cleared and `tryActivateEncounter` succeeds; the unlock gate is enforced via
  `users.isQuestTierUnlocked`. The shortcut does not skip validation or the
  encounter machine.

## Tests
All six relevant suites pass locally: 149 tests green
(`citadel_sovereign`, `citadel_capstone_quest`, `citadel_arena`,
`citadel_capstone_e2e`, client `dungeon`, `renderer-citadel-sovereign`).
Cross-cutting "this boss is the apex" invariants are pinned by assertions, so a
future boss that out-stats the Sovereign will fail CI.

## Remaining gaps
None blocking. The capture not visually reaching the citadel arena is a
capture-plan fallback, not a defect; runtime health is proven and the citadel
path is covered by passing unit + e2e suites. One minor non-blocking redundancy
is noted in `nits.md`.

VERDICT: PASS