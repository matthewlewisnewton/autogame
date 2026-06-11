# Chrono Trigger — time-ripple VFX primitive

Add a dedicated `spawnChronoTriggerEffect` primitive in `renderer.js` so Chrono Trigger reads unmistakably as a temporal charge-reset spell — layered cyan/amber time ripples with clock-tick accents — instead of the generic `spawnTelegraphRing` + `spawnParticleBurst` pair used today. This primitive is the visual foundation sub-ticket 02 composes via `renderChronoTrigger`.

## Acceptance Criteria

- `spawnChronoTriggerEffect(origin, radius, style = {})` in `game/client/renderer.js` registers **at least two** transient meshes in `activeEffects` with finite `duration` (default `SUMMON_EFFECT_DURATION` or `style.duration`):
  1. A **dual-phase time ripple**: two concentric ground rings that expand outward in staggered waves (modeled on the multi-wave pulse pattern in `spawnPurifyingPulseHealRing`, but with Chrono Trigger's cyan/amber palette and faster tick cadence).
  2. A brief **temporal column/wisp** rising from the origin (open-ended cylinder or tapered shaft, `isChronoTriggerColumn: true`, animated rise-then-fade in `updateAttackEffects()` like `isLightColumn` / `isThermalColumn`).
- Default palette matches the card accent: color `0xf59e0b` (amber, from `cards.js` `#f59e0b`), emissive `0x67e8f9` (cyan temporal glow); overridable via `style.color` / `style.emissive`.
- Ripple rings use `isChronoTriggerRipple: true` with per-wave `wave` / `waveCount` metadata so `updateAttackEffects()` staggers expansion (no `setTimeout` in the spawn path).
- Every mesh is added to `window.___test_scene || scene` and cleaned up via the existing `updateAttackEffects` lifecycle.
- No per-frame geometry allocation; mesh count for one cast stays in the same order of magnitude as `spawnTelepipeCastEffect` (ring(s) + column).
- `game/client/test/vfx-primitives.test.js` adds a smoke test: spawn pushes entries flagged `isChronoTriggerRipple` and `isChronoTriggerColumn`, asserts amber/cyan palette, finite duration, and cleanup after `updateAttackEffects()` when past duration.
- No changes to `cardRenderers.js`, `main.js`, server code, or other cards' primitives.

## Technical Specs

- **`game/client/renderer.js`**:
  - Add palette constants near other spell palettes: `CHRONO_TRIGGER_COLOR = 0xf59e0b`, `CHRONO_TRIGGER_EMISSIVE = 0x67e8f9`, `CHRONO_TRIGGER_COLUMN_HEIGHT` (≈ 1.2–1.6).
  - Implement `spawnChronoTriggerRipple(origin, radius, style)` — pushes 2 staggered expanding ring meshes with `isChronoTriggerRipple: true`.
  - Implement `spawnChronoTriggerColumn(origin, style)` — tapered cylinder wisp with `isChronoTriggerColumn: true`; animate in `updateAttackEffects()`.
  - Export `spawnChronoTriggerEffect(origin, radius, style = {})` composing ripple + column; default `radius` fallback `2` (matches `CHRONO_TRIGGER_TELEGRAPH_RADIUS` in `cardRenderers.js`).
- **`game/client/test/vfx-primitives.test.js`**: import `spawnChronoTriggerEffect`; assert effect flags, palette, finite duration, cleanup.
- Do **not** modify `cardRenderers.js`, `main.js`, or server code in this sub-ticket.

## Verification: code
