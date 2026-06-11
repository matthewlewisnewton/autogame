# Restoration Beacon: emerald restoration beacon pillar

Make the Restoration Beacon (`healing_font`, spell) animation unmistakably read
as its name — a vertical **beacon** pillar of restorative emerald light rising
from the cast origin with ascending heal motes — instead of the current flat
green ground ring. Keep it visually distinct from Sanctum Pulse (`divine_grace`,
its golden column evolution), and fire every primitive synchronously with the
server's instant single `cardUsed` resolution (no projectile/DoT/wind-up phase,
so no `setTimeout`/`scheduleAfter`).

## Acceptance Criteria

- A new exported VFX primitive (e.g. `spawnRestorationBeaconEffect(origin, radius)`)
  exists in `game/client/renderer.js` that spawns a **vertical emerald light
  beacon pillar** rising from the origin (reuse the existing `isLightColumn`
  ascending-column mechanism used by `spawnDivineGraceColumn`, so it grows
  upward from a ground-pinned base with no per-frame allocation), plus the
  ground heal ring and ascending restoration motes.
- The beacon uses an **emerald/green** palette (aligned with the
  `healing_font` accent `#86efac` / emissive `0x4ade80`) and a **distinct
  silhouette** from Sanctum Pulse's gold column — it does NOT reuse
  `spawnDivineGraceColumn`/`spawnDivineGraceEffect` or their gold color
  constants. New dedicated `RESTORATION_BEACON_*` color/geometry constants are
  defined for it.
- `renderHealingFont` in `game/client/cardRenderers.js` is rewired to spawn the
  new beacon effect via the ctx (e.g. `ctx.spawnRestorationBeaconEffect`),
  replacing the bare telegraph-ring-only signature; the heal sound is still
  played only for the local caster (`data.hpGained > 0 && data.playerId === ctx.myId`).
- The new primitive is imported and wired into the renderer ctx object in
  `game/client/main.js` (same pattern as `spawnDivineGraceEffect`).
- All Restoration Beacon primitives fire synchronously within the
  `renderHealingFont` call — no `setTimeout`, `scheduleAfter`, or async sequencing
  (matches the instant server resolution; any per-effect stagger is baked into
  `createdAt`, not timers).
- A vitest client test (in `game/client/test/cardRenderers.test.js` or a new
  `game/client/test/renderer-restoration-beacon.test.js`) asserts that
  `renderHealingFont` invokes the beacon effect and the heal ring on a `cardUsed`
  payload, gates the heal sound to the caster only, and does not throw when
  optional ctx spawners are absent.
- `pnpm test` (vitest server+client) passes; no perf regression (no new
  per-frame allocations in the update loop).

## Technical Specs

- `game/client/renderer.js`: add `RESTORATION_BEACON_*` palette/geometry
  constants and an exported `spawnRestorationBeaconEffect(origin, radius)` that
  pushes (a) an emerald ascending light column entry flagged `isLightColumn`
  (mirroring `spawnDivineGraceColumn`, but narrower/brighter and green), (b) a
  ground heal ring (RingGeometry scaled to `radius`, like
  `spawnDivineGracePulseRing`), and (c) an upward emerald mote burst. Drive
  animation through the existing `updateAttackEffects` `isLightColumn` branch
  and the standard ring/particle update paths — do not add new per-frame
  allocations.
- `game/client/cardRenderers.js`: update `renderHealingFont` (and its doc
  comment) to call `ctx.spawnRestorationBeaconEffect?.(origin, data.radius)`
  guarded for absence, keep an optional `ctx.spawnParticleBurst` accent if
  desired, and keep the existing caster-gated `ctx.playSound('heal')`. Leave
  `renderDivineGrace`/`renderPurifyingPulse` untouched.
- `game/client/main.js`: import `spawnRestorationBeaconEffect as
  rendererSpawnRestorationBeaconEffect` and add
  `spawnRestorationBeaconEffect: rendererSpawnRestorationBeaconEffect` to the
  renderer ctx object (near the existing `spawnDivineGraceEffect` wiring).
- `game/client/test/`: add/extend a vitest test using the existing mock-ctx
  `record()` harness in `cardRenderers.test.js` (a `record('spawnRestorationBeaconEffect')`
  spy) to assert the calls and sound gating above.
- Do NOT modify `game/server/` (resolution is already instant) or any other
  card's renderer/registration.

## Verification: code
