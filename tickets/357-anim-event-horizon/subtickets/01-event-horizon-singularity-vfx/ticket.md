# Event Horizon — singularity pull-field VFX primitive

Add a dedicated `spawnEventHorizonEffect` VFX primitive so Event Horizon reads
unmistakably as a black-hole singularity — not a recolored Gravity Well. Build
it from the 315 `activeEffects` / `updateAttackEffects` pattern in `renderer.js`.

## Acceptance Criteria

- `spawnEventHorizonEffect(origin, pullRadius, centerRadius, style?)` is exported
  from `renderer.js` and pushes one or more meshes into `activeEffects` with a
  finite `duration` (no `requestAnimationFrame` one-offs).
- The silhouette is singularity-themed: a near-black void core at the origin,
  a violet accretion-style ring at `centerRadius`, and an outer pull halo at
  `pullRadius` that **contracts inward** (starts at full radius, shrinks toward
  the core) — visually distinct from the expanding `spawnTelegraphRing` used by
  Gravity Well.
- Palette uses the Event Horizon accent family (`color` fallback `0x581c87`,
  `emissive` fallback `0x7c3aed`) with a darker void core (`≤ 0x1a0a2e`).
- Inward-spiraling edge particles (or equivalent inward velocity in the
  primitive's update branch) reinforce the pull field; total mesh/particle count
  stays in the same order of magnitude as other spell primitives (no perf
  regression).
- `updateAttackEffects` has an `isEventHorizonEffect` branch that animates
  contraction, core pulse, and fade; expired meshes are disposed like other
  primitives.
- Primitive-level test in `game/client/test/vfx-primitives.test.js` asserts the
  effect registers in `activeEffects`, carries the expected flags/radii, uses the
  event-horizon palette, and cleans up after expiry.
- Do **not** modify `renderEventHorizon`, card registration, or `main.js` ctx
  wiring — those belong in sub-ticket 02.

## Technical Specs

- `game/client/renderer.js`:
  - Add palette constants near the other VFX blocks (e.g.
    `EVENT_HORIZON_CORE_COLOR`, `EVENT_HORIZON_RING_COLOR`,
    `EVENT_HORIZON_EMISSIVE`).
  - Implement `spawnEventHorizonEffect(origin, pullRadius, centerRadius, style =
    {})` using `window.___test_scene || scene`, registering meshes with
    `isEventHorizonEffect: true`, `pullRadius`, `centerRadius`, `createdAt`,
    and `duration` (default `SUMMON_EFFECT_DURATION` or a named constant
    ~700–1000 ms).
  - Add the per-frame update branch in `updateAttackEffects` (contract outer
    halo, pulse accretion ring, fade/dispose).
- `game/client/test/vfx-primitives.test.js`:
  - Import `spawnEventHorizonEffect`; add coverage for spawn, palette, radii,
    and cleanup (back-date `createdAt` + call `updateAttackEffects`).

Server reference (for radii only — no server changes): `event_horizon` uses
`pullRadius: 12`, `centerRadius: 2.5` (`game/shared/cardStats.json`).

## Verification: code
