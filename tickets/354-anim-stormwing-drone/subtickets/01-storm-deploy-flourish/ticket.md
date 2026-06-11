# Stormwing Drone deploy: aerial storm-flight summon flourish

Polish the Stormwing Drone (`storm_eagle`) deploy animation so the summon-in
reads unmistakably as a storm-charged flying drone taking off — a cyan storm
palette with wing/wind motion cues — and stays visually distinct from its
evolved form Thunderbird. Touch only this card's summon renderer + its
registration so the other per-card animation beads are unaffected.

## Acceptance Criteria

- Deploying a Stormwing Drone (event with `minionId` and no `hits`) calls
  `ctx.spawnMinionSummonInEffect` exactly once at the minion origin.
- The summon style uses a cyan/storm palette (`color: 0x93c5fd`,
  `emissive: 0x7dd3fc` or a clearly storm-themed cyan) and is visibly distinct
  from Thunderbird's brighter sky-blue summon (`0x38bdf8`/`0x0ea5e9`) — e.g. a
  smaller radius and/or tighter burst that reads as the lighter, smaller drone.
- The deploy adds a wing/wind read on top of the base flourish (e.g. an extra
  `ctx.spawnParticleBurst` or `ctx.spawnTelegraphRing` with the storm palette)
  so it is not a bare generic summon ring.
- No lightning arc (`ctx.spawnLightningArc`) is spawned on the deploy event.
- `renderStormEagleSummon` remains registered as the first entry for
  `storm_eagle` in the card renderer registry; resolving renderers for
  `storm_eagle` still returns 2 functions.
- A client test in `cardRenderers.test.js` asserts the summon palette, the
  added wing/wind cue, the distinctness from Thunderbird, and that no arc is
  spawned. Full client + server vitest suites pass; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`: update `renderStormEagleSummon`
  (~line 1077) and keep the `storm_eagle` registration (~line 1766) with
  `renderStormEagleSummon` first. Reuse existing ctx primitives only
  (`spawnMinionSummonInEffect`, `spawnParticleBurst`, `spawnTelegraphRing`);
  guard every optional ctx call with a presence check as the existing code
  does. Do not alter Thunderbird's renderer or palette.
- `game/client/test/cardRenderers.test.js`: extend the existing
  `storm_eagle summon` test (~line 2441) / add assertions for the new cue and
  Thunderbird distinctness.

## Verification: code
