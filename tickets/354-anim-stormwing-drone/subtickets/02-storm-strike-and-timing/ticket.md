# Stormwing Drone ranged strike: storm bolt + server-timing sync

Polish the Stormwing Drone (`storm_eagle`) ranged-strike animation so the
attack reads as a jagged storm bolt fired from the aerial drone down onto its
target, with the impact landing on the actual resolved hit point and the VFX
firing exactly once per server strike event (the minion fires every
`attackIntervalMs` = 1500ms; the card has no `windUpMs`, so the strike resolves
instantly with no wind-up telegraph).

## Acceptance Criteria

- A strike event (has `origin`, `direction`, and non-empty `hits`) spawns
  exactly one `ctx.spawnLightningArc` in the Stormwing Drone storm palette
  (`0x67e8f9`/`0x22d3ee`).
- The arc terminates at the server-provided `data.strikeTarget` when present
  (impact synced to the real hit), falling back to a point along the direction
  by `attackRange` only when `strikeTarget` is absent.
- The arc uses the 3D tilted `direction` (its `y` component when finite) and
  originates from the drone's aerial position so the bolt reads as coming from
  a flying drone rather than from the ground.
- Exactly one impact `ctx.spawnParticleBurst` is spawned at the strike target
  in the storm palette; no extra arcs/bursts are emitted (no per-frame growth —
  the handler runs once per event).
- The summon path is untouched: an event with `minionId` and empty `hits` spawns
  no arc and no impact burst.
- A client test in `cardRenderers.test.js` asserts: single arc to
  `strikeTarget`, the `y`/3D direction handling, the single impact burst, and
  that a summon-only event produces neither. Full client + server vitest suites
  pass; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`: update `renderStormEagleStrike`
  (~line 1092) and `STORM_EAGLE_ARC_STYLE` (~line 937). Keep the
  `data.origin && data.hits?.length` guard so summon events are ignored. Use
  `originOf`/`directionOf`/`pointAlong` helpers; pass the 3D direction through
  to `spawnLightningArc`. Resolve the aerial origin height from the minion's
  position via available ctx state (mirror how other minion renderers read
  origin `y`); if no height is available, keep current behavior. Reuse existing
  ctx primitives only and guard optional calls.
- `game/client/test/cardRenderers.test.js`: extend the existing
  `storm_eagle attack` test (~line 2456) with the strikeTarget, 3D direction,
  single-burst, and summon-no-arc assertions.

## Verification: code
