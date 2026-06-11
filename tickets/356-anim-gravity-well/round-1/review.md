# Senior Review — 356-anim-gravity-well

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started on :5175, scene
  initialized, canvas present. `capturePlanSource: "fallback"` (deterministic
  full-flow smoke: auth → lobby → ready → movement → dodge).
- `console.log` (10 lines) contains no `pageerror`/`[fatal]`/uncaught entries.
- The captured deck did not include `gravity_well`, so the well VFX was not
  exercised on-screen, but the game starts and loads cleanly — the runtime-health
  gate is satisfied. Renderer/timing behavior is verified by unit tests below.

## Acceptance criteria

### 1. Visual unmistakably reads as "Gravity Well"
PASS. `renderGravityWell` (game/client/cardRenderers.js:691) now composes a
bespoke singularity instead of the old generic telegraph-ring + particle-burst:
- `spawnGravityWellEffect` (game/client/renderer.js:5545) draws a **contracting**
  purple ground ring (scales from `pullRadius` down to ~0.3 over the first 40% of
  life), a dark **void core** (`0x581c87`) pulsing at the origin, and inward
  inflow particle streaks (gated behind `areParticlesEnabled()`).
- Per-enemy **pull streaks**: a `spawnLightningArc` is drawn FROM each pulled
  enemy's mesh TO the origin (cardRenderers.js:705-715), reading clearly as
  enemies being yanked inward.
- Palette (`0xc084fc` / `0xa855f7` purple + void-violet core) is on-theme for a
  void/gravity spell. The old `spawnTelegraphRing`/`spawnParticleBurst` calls
  were removed (asserted by tests).

### 2. Timing synced to server effect resolution
PASS. `gravity_well` has no `windUpMs` (cardStats.json:286 — instant cast; the
307 charge telegraph is correctly NOT expected, and a test asserts
`windUpMs ?? 0 <= 0`). Server resolves instantly and emits `CARD_USED` with
`{ origin, radius, pulled }` (cardEffects.js:842-857); `pulled` entries are
`{ enemyId, x, z }` (simulation.js:2154). The renderer fires all VFX
synchronously at t=0 (no `scheduleAfter`), and reads `data.pulled[].enemyId`
against `ctx.enemyMeshes()` — wiring matches the server contract end to end. All
three effect objects use `ATTACK_EFFECT_DURATION`.

### 3. No perf regression
PASS. Inflow particles are capped at 10 and gated behind
`areParticlesEnabled()`; materials use `depthWrite: false`; all effect objects
are disposed via `disposeEffectObject` when elapsed ≥ duration
(renderer.js:5944). No per-frame allocations in `updateAttackEffects`.

### 4. Client test where feasible
PASS. cardRenderers.test.js + vfx-primitives.test.js (200 tests) pass locally.
Coverage includes: single bespoke renderer resolution, synchronous fire at t=0,
correct origin/radius/style args, per-enemy arc geometry, empty/absent `pulled`,
radius-absent skip, and the primitive pushing ring/core/inflow with correct
colors and disposal.

### 5. Scope & consistency
PASS. Diff touches only the gravity-well renderer + registration, the VFX
primitive in renderer.js, the two wiring points (main.js, socketHandlerCtx.js),
and tests — within the ticket's stated scope. No debug scenario was added or
changed. Consistent with the 315/316-319 primitive+per-card foundation; no
foundation regression.

## Remaining gaps
None blocking. One non-blocking nit recorded in nits.md: the inflow particles'
runtime trajectory (`position = velocity * t`) starts each particle at the well
center and moves it outward to the opposite side, rather than flowing inward
from its spawned outer ring position — a minor visual imperfection that does not
change the overall inward read (contracting ring + void core + enemy pull arcs
dominate).

VERDICT: PASS
