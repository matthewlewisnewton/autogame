# 02 — Saber reach + swift_slash timing sync + client test

Make the radiant saber swing's on-screen reach track the server's actual
`attackRange` (which widens with grind via `aoeGrindScale`) instead of a
hardcoded value, and keep the swing immediate to match the `swift_slash`
fast-attack feel (cooldown 400ms, no wind-up). Add a client test that locks in
the renderer wiring, the grind-aware reach, and the light primitives.

## Acceptance Criteria

- `renderSaberOfLight` sizes its cone swing and places its impact flash/sparks
  from `data.attackRange` (falling back to a sane default when absent), so a
  higher server `attackRange` produces a visibly longer reach. It does NOT use a
  hardcoded range constant for the saber.
- The swing is immediate (`swift_slash`): the cone, telegraph flash, and spark
  burst for a single swing all fire synchronously with the card use (no
  artificial delay before the first swing); only `swingCount > 1` uses staggered
  `scheduleAfter` like the other multi-swing blades. saber_of_light has
  `swingCount === 1`, so its visual lands in one immediate beat aligned to the
  server hit resolution.
- A client unit test in `game/client/test/cardRenderers.test.js` asserts:
  (a) `resolveRenderers('saber_of_light')` returns one dedicated renderer
  distinct from the plain cone default and from `renderWeaponSwing`;
  (b) invoking the renderer via `renderCardUsed`/the resolved renderer with a
  small `attackRange` vs a large `attackRange` places the impact/spark point (or
  passes a cone `range`) proportionally farther for the larger value;
  (c) the light-themed primitives (`spawnAttackEffect` plus the telegraph/spark
  calls) are recorded by the mock `ctx`.
- `pnpm test:quick` (client+server vitest) passes.

## Technical Specs

- `game/client/cardRenderers.js`: in `renderSaberOfLight`, derive
  `const range = data.attackRange || <default e.g. 5>;` and use it for the
  `spawnAttackEffect` cone `range` and for `pointAlong(origin, direction, range * k)`
  impact placement. Keep the single-swing path synchronous; reuse the
  `swingCount`/`scheduleAfter` loop only for extra swings.
- `game/client/test/cardRenderers.test.js`: add a `describe('saber_of_light ...')`
  block using the existing `makeCtx()` recorder (it already mocks
  `spawnAttackEffect`, `spawnTelegraphRing`, `spawnParticleBurst`,
  `scheduleAfter`, etc.). Build `data = { cardId: 'saber_of_light',
  specialEffect: 'swift_slash', origin: {...}, direction: {...}, attackRange: N,
  swingCount: 1 }`, call the resolved renderer twice with different `attackRange`,
  and assert reach scaling + recorded primitive names. Mirror the existing
  `excalibur_photon` / styled-blade test idioms in this file.
- Note: the server already sends grind-scaled `attackRange` in `CARD_USED`
  (`game/server/cardEffects.js`, via `effectiveAttackRange`); the client just
  needs to honor it. Do not change any server file.

## Verification: code
