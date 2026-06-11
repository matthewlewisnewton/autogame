# Remove legacy flag dispatch and finalize kind-only registration

## Description

After sub-tickets 01–05, `updateAttackEffects` should be a thin generic loop with no remaining `if (fx.is…)` or positional field checks. Delete the transitional fallback, ensure every `activeEffects.push` sets `kind`, and document that new VFX only require registering an updater.

## Acceptance Criteria

- `updateAttackEffects` contains no `if (fx.is…)`, `fx.returning`, or `fx.radius !== undefined` dispatch; body is ~15–25 lines: iterate, `elapsed`, `runAttackEffectUpdater`, expire/dispose
- Every `activeEffects.push` in `game/client/renderer.js` includes `kind: ATTACK_EFFECT_KINDS.…` (grep confirms zero pushes without `kind`)
- Unknown `kind` logs a console warning once per kind and disposes on expiry (or throws in test builds)—no silent fall-through
- Boolean flags (`isLightColumn`, `isFireTrail`, etc.) removed from effect payloads unless still needed for non-dispatch metadata (prefer removing)
- Tests assert `fx.kind` instead of boolean flags for dispatch identification
- Add a focused test: registering a dummy updater + spawning an effect with that `kind` animates and cleans up without editing `updateAttackEffects`
- Full `pnpm test` (client vitest suite) passes

## Technical Specs

- **`game/client/renderer/attackEffectUpdaters.js`**
  - Export `registerAttackEffectUpdater(kind, fn)` or frozen map pattern for extension
  - Add module-level comment: "To add a new VFX: set `kind` in spawner, register updater here"
- **`game/client/renderer.js`**
  - Replace `updateAttackEffects` body with registry-only dispatch
  - Strip obsolete boolean flags from all `activeEffects.push` calls
- **`game/client/test/vfx-primitives.test.js`** (or new `attack-effect-updaters.test.js`)
  - Add registry registration smoke test
  - Update remaining flag-based lookups (`fx.isLightColumn`, `fx.radius !== undefined`, `fx.spikeTrapRing`, etc.)

## Verification: code
