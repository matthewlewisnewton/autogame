# Infinite Disk: spinning photon-disc theme + payload-synced return passes

Polish `renderTripleReturning` so Infinite Disk reads unmistakably as its name:
three spinning cyan **photon discs** that fan out to the weapon's range and
**return** (boomerang) for each server return-pass, instead of three static
flashes. Drive the visual's range and the number of return beats from the
`cardUsed` payload (`attackRange`, `returnPasses`) so the animation stays in
sync with the server's instant outbound+return-pass resolution.

## Acceptance Criteria

- The `infinite_disk` / `triple_returning_projectile` renderer still spawns the
  three fanned discs on the outbound pass (three `spawnAttackEffect` calls
  offset along the perpendicular axis, sharing the cyan disc style
  `{ color: 0xa5f3fc, emissive: 0x22d3ee }`).
- The renderer reads `data.returnPasses` from the payload and schedules that
  many additional **return** beats (via `scheduleAfter`), each replaying the
  disc trail/flash travelling back toward the origin, so a `returnPasses: 3`
  cast produces an outbound throw followed by 3 return beats. The beat count
  must follow the payload value (e.g. a payload with `returnPasses: 2`
  schedules 2 return beats), not a hardcoded constant.
- The renderer reads `data.attackRange` to size the disc travel
  (`spawnProjectileTrail` range and the spark-burst distance), falling back to
  a sane default when `attackRange` is absent, instead of the previous
  hardcoded `range: 6` / `3.5` literals.
- Return beats reuse the 315 shared primitives only (`spawnProjectileTrail`,
  `spawnParticleBurst`, and/or `spawnAttackEffect`) — no new bespoke geometry —
  and the return trail/burst travels from the far point back toward the origin
  so the "returning disc" motion is visible.
- The renderer degrades gracefully when optional ctx primitives
  (`spawnProjectileTrail`, `spawnParticleBurst`, `scheduleAfter`) are absent: it
  must not throw and must still spawn the three outbound discs.
- Total return-beat timing stays short (each beat scheduled within a small
  fixed cadence, on the order of `ATTACK_EFFECT_DURATION`) so the flourish does
  not lag behind the server's same-tick hit resolution; do NOT introduce a
  long cast wind-up (this card has no `windUpMs`).
- `infinite_disk` remains registered to this renderer in `CARD_RENDERERS`.
- Client tests in `game/client/test/cardRenderers.test.js` cover the new
  behaviour: the existing three-disc / trail / spark / graceful-degradation
  tests still pass (update expected literals if range-derivation changes them),
  plus a new test asserting the number of scheduled return beats tracks
  `data.returnPasses`.
- `pnpm test` (vitest server+client) passes; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Rework `renderTripleReturning(data, ctx)` (around line 558) to:
    - keep the three perpendicular-offset outbound `spawnAttackEffect` discs and
      the cyan style;
    - derive `range` from `data.attackRange` (fallback e.g. `6`) and use it for
      `spawnProjectileTrail` range and the `pointAlong` spark-burst distance;
    - read `const passes = Math.max(0, data.returnPasses ?? 0)` (or treat the
      `triple_returning_projectile` effect default) and, for each return beat,
      `ctx.scheduleAfter(beatMs * (i+1), …)` spawning a return-direction trail
      (origin = far point, direction = reversed) plus a small spark burst so the
      disc visibly comes back; guard each optional primitive with an existence
      check.
  - Leave the `infinite_disk: renderTripleReturning` registration (line ~2081)
    intact; do not touch other cards' renderers/registrations.
- `game/client/test/cardRenderers.test.js`: update the existing `infinite_disk`
  tests if literal expectations shift, and add a test that passing
  `returnPasses` schedules the matching number of return beats (count
  `scheduleAfter` calls, e.g. via the mocked ctx), and that omitting optional
  primitives still spawns the three discs without throwing.
- Helpers `originOf`, `directionOf`, `pointAlong`, `getAccentHex`, and
  `ATTACK_EFFECT_DURATION` already exist in this module/config — reuse them.
- Server (`cardEffects.js`) already emits `attackRange` and `returnPasses` in
  the `cardUsed` payload for this card; do NOT change the server.

## Verification: code
