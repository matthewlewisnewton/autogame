# Alloy timing, knockback sync, and test coverage

Align Alloy Greatblade's client animation timing with the server effect
resolution: `windUpMs` charge telegraph during commit, then an instant single
cleave when `cardUsed` arrives, with impact at the server's `attackRange` and a
knockback burst keyed off `data.knockbackMoved`. Add comprehensive tests
documenting the server timing contract.

## Background (verified, do not re-derive)

- Server emits `CARD_USED` for `steel_claymore` from the weapon branch in
  `game/server/cardEffects.js` with: `cardId`, `specialEffect: 'knockback'`,
  `origin`, `direction`, `attackRange`, `attackConeAngle`, `hits`,
  `knockbackMoved`, and `swingCount` (defaults to 1 — no `swingsPerUse` on this
  card).
- `cardStats.json` gives `steel_claymore` `windUpMs: 600`, `attackRange: 7`,
  `knockbackStrength: 3`, `specialEffect: 'knockback'`. There is no projectile
  travel, no DoT, and no multi-swing stagger (`swingsPerUse` is absent).
- The 315 charge telegraph in `renderer.js` handles the wind-up phase from server
  `cardWindupUntil` state — the renderer must NOT add an extra client-side
  wind-up delay; the cleave fires immediately when `CARD_USED` arrives.
- `knockbackMoved` is a non-empty array when enemies were knocked back on that
  swing; empty (`[]`) when no knockback occurred. The knockback burst MUST be
  gated on `data.knockbackMoved?.length > 0`.

## Acceptance Criteria

- `renderAlloyGreatblade` uses `data.attackRange ?? style.range` (not a
  hardcoded constant) for the strike point via `pointAlong(origin, direction,
  range)` so impact visuals track grind-scaled reach from the server payload.
- All per-swing VFX (cone, trail, decal, burst) fire synchronously at `t = 0`
  when `cardUsed` arrives — no `scheduleAfter` delay for the primary cleave
  (this card has `swingCount: 1` and no `photon_barrage`).
- When `data.knockbackMoved?.length > 0`, the renderer layers a distinct
  knockback burst at the strike point — e.g. an expanding
  `spawnTelegraphRing` plus a heavier `spawnParticleBurst` conveying force
  rippling outward along the swing direction. When `knockbackMoved` is empty,
  absent, or `[]`, NO knockback burst layer is spawned.
- No projectile-travel delay, wind-up-charge, or DoT VFX are added in the
  renderer (wind-up is server-side + existing 315 telegraph; this is an instant
  melee cleave).
- Every `ctx.*` call remains guarded so the renderer never throws when a
  primitive is absent.
- Tests in `game/client/test/cardRenderers.test.js`:
  - Firing `steel_claymore` with `{ attackRange: 9 }` places impact primitives
    at `{ x: 9, z: 0 }` (not the style default 7).
  - Firing with `knockbackMoved: [{ enemyId: 'e1', … }]` emits the knockback
    burst layer; firing with `knockbackMoved: []` does not.
  - `CARD_DEFS.steel_claymore.windUpMs === 600` is asserted to document the
    server wind-up contract.
  - The existing heavy-greatsword test group is narrowed so alloy-specific
    assertions live in dedicated `steel_claymore` / Alloy Greatblade describe
    blocks; `magma_greatsword`-only tests stay on `renderHeavyGreatsword`.
  - Graceful-degradation test (ctx with optional primitives `undefined`) still
    passes for `steel_claymore`.
- Existing client + server vitest suites still pass; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Refactor `renderAlloyGreatblade` to read `range = data.attackRange ??
    style.range` for all strike-point calculations.
  - Add a guarded knockback block:
    `if (data.knockbackMoved && data.knockbackMoved.length > 0) { … }` spawning
    `spawnTelegraphRing(impactAt, radius, …)` and/or a directional
    `spawnParticleBurst` at `impactAt` with slate alloy palette.
  - Ensure impact primitives (decal, burst, trail terminus) all use the same
    `impactAt` derived from `data.attackRange`.
  - Do not modify server files, `renderHeavyGreatsword`, or any other card's
    renderer.
- `game/client/test/cardRenderers.test.js`:
  - Add dedicated `steel_claymore` timing/knockback tests as described above.
  - Update `returns the heavy greatsword renderer for alloy/corebreaker` to
    assert only `magma_greatsword` uses `renderHeavyGreatsword`; alloy has its
    own renderer.
  - Migrate/update existing alloy assertions from the shared heavy-greatsword
    describe block into alloy-specific tests.

## Verification: code
