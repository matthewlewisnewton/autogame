# Senior Review: 255-level2-rooms

## Per-Criterion Findings

### Runtime health

PASS. The captured run loaded cleanly. `metrics.json` reports `"ok": true`, includes a connected gameplay probe with `sceneInitialized: true`, `hasCanvas: true`, `phase: "playing"`, and an empty `pageerrors` array. `pageerrors.json` is empty. `console.log` contains only Vite connection logs, expected 409 auth-conflict resource messages from the harness flow, and scene initialization logs; there are no `pageerror` or `[fatal]` lines from game code.

### Rooms Tier-2 playable

PASS. The live code exposes deployable Tier 2 variants for both rooms-family profiles requested by the ticket:

- `training_caverns` Tier 2 uses the `crowded` profile, `layoutMode: 'rigid'`, Tier 2 unlock metadata, and remains in `listQuestVariants()`.
- `crystal_rescue` Tier 2 uses the `open` profile, `layoutMode: 'rigid'`, Tier 2 unlock metadata, scaled item/enemy/reward values, and remains in `listQuestVariants()`.

Normal lobby selection is unlock-gated, regenerates the layout through `applyLayoutForQuest`, assigns spawn positions, and broadcasts the tier-specific layout. The ready/deploy path also rejects a Tier 2 launch when any connected squad member lacks the unlock.

### More rigid layout

PASS. `generateLayout(seed, 'crowded' | 'open', { layoutMode: 'rigid' })` normalizes unknown modes back to default, but in rigid mode removes structural seed variance for the grid profiles: fixed start cell, deterministic frontier/DFS picks, fixed room dimensions, no random extra loop edges, and fixed ramp room indices when slopes are enabled. Dressing is also ordered rather than shuffled for rigid crowded/open layouts.

The added tests verify that rigid `crowded` and `open` layouts are stable across different seeds for rooms, passages, and profile dressing, while default mode still varies across seed sweeps.

### Carries rooms identity

PASS. The rigid `crowded` path preserves crowded identity with combat-room cover and only crowded landmark types (`reactor_coil` / `pipe_stack`). The rigid `open` path preserves open identity with raised platforms, pit hazards, light cover, and only open landmark types (`sand_spire` / `sun_arch`). Existing slope/floor sampling and walkability foundations remain consistent with `game/docs/design.md`.

### Higher variant rate

PASS. Tier 2 runs use the existing quest-tier variant scaling path: `spawnEnemy` resolves `run.questTier` / selected quest tier through `resolveVariantRollTier`, so Tier 2 rolls at full variant chance while Tier 1 remains effectively untagged. The Tier 2 quest tests cover fixed-seed variant tagging for both `training_caverns` and `crystal_rescue`, and the runtime capture still shows normal Tier 1 enemies unbroken.

### Debug scenarios

PASS. The added `training-caverns-tier-2` and `crystal-rescue-tier-2` debug scenarios are behind the existing debug-scenario path: the browser only requests them from the localhost-only `?debugScenario=` parameter, and the server rejects unknown/disabled debug scenarios unless the debug gate allows them. Both shortcuts set quest id/tier and apply the Tier 2 layout before entering playing phase, so run metadata and variant rolls match normal deployment. The same states are reachable through normal gameplay by clearing each Tier 1 quest, unlocking Tier 2, selecting it, and deploying.

### Tests and coverage visibility

PASS. `coverage.log` shows the full suite passing: 79 test files and 1456 tests passed. Coverage was reported for changed files with thresholds disabled. The relevant new tests cover quest catalog/options, rigid layout determinism and identity, spawn placement, variant tagging, unlock persistence, deploy gating, and debug scenarios.

## Remaining gaps

None.
VERDICT: PASS
