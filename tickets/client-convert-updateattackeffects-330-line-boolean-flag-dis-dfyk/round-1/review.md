# Senior Review — convert updateAttackEffects boolean-flag dispatch to per-effect updaters

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, `capturePlanValid: true`, scene
  initialized (`sceneInitialized: true`, `hasCanvas: true`), full smoke flow ran
  (auth → lobby → ready → movement → dodge with cooldown HUD probe confirming
  `keyItemCooldownRemaining: 379` then back to 0).
- `console.log`: only `[vite] connecting/connected`, `[initScene]`, `launchBooth`,
  and a `409 (Conflict)` on a resource load — the latter is the harness's benign
  lobby/resource-claim race, not a game-code fatal. No `pageerror`/`[fatal]` lines.
- Game starts and loads cleanly. Gate passes.

## Acceptance criteria

### "Effect dispatch is table/closure driven (no positional flag chain)"
PASS. The dispatch loop (`renderer.js:7108-7125`) is fully generic: it computes
`elapsed`, calls `runAttackEffectUpdater(fx, elapsed)`, then `shouldExpireAttackEffect`
→ `disposeAttackEffect`. No `fx.radius !== undefined`, `fx.isLightColumn`,
`fx.isSpikeTrapSpike`, `fx.returning`, or any other boolean-flag/positional branch
remains in the loop (grep for the old flags returns nothing). Dispatch is keyed off
`fx.kind` into `ATTACK_EFFECT_UPDATERS` in
`game/client/renderer/attackEffectUpdaters.js`. The positional-`radius` hazard called
out in the ticket is eliminated — expand/fade rings now carry explicit
`expandFadeRing`/`spikeTrapRing`/`dragonsBreathScorch` kinds rather than being
inferred from a `radius` field.

### "all existing VFX behave identically (renderer/vfx tests pass)"
PASS. The per-effect updaters are line-for-line translations of the old branch
bodies (same easing constants, same scale/opacity/emissive math, same disposal
routing for line effects vs mesh effects vs `mirrorWardShell` map cleanup in
`disposeAttackEffect`). Verified by tests:
- Targeted: `attack-effect-updaters.test.js`, `vfx-primitives.test.js`,
  `renderer-registry-normalize.test.js`, `renderer-spike-trap.test.js` → 69/69 pass.
- Full client + server vitest suite → 3966/3966 pass (run cleanly twice). One
  intermediate run showed a single failure in `server/test/*` only; this diff is
  client-renderer-only and cannot influence server logic, and the project has a
  documented pre-existing server flake — not a regression from this ticket.
- All 56 `activeEffects.push(...)` sites carry a `kind:` (56 pushes / 56 kinds),
  so no effect silently falls through to the no-updater path.

### "adding a new effect requires only registering an updater"
PASS. New VFX path is: set `kind: ATTACK_EFFECT_KINDS.foo` in the spawner +
`registerAttackEffectUpdater('foo', fn)` (or add to `ATTACK_EFFECT_UPDATERS`).
`warnUnknownAttackEffectKind` throws under vitest, so a spawner that ships a kind
with no registered updater is caught by tests rather than silently animating
nothing.

## Consistency / regressions
- No `game/docs/design.md` or `requirements.md` behavior is touched; this is a pure
  internal refactor of client-side VFX dispatch. No server, net-replication, or
  persistence surface changed.
- No debug scenario was added or changed by this ticket.
- Disposal edge cases preserved: `lightningArc`/`hitSpark` route through
  `disposeLineEffect`; `mirrorWardShell` clears its per-player map entry.

## Remaining gaps
None blocking. (One documentation nit recorded in `nits.md`: several spawner
comments still reference the removed `isLightColumn`/`isThermalColumn`/etc.
"branch in updateAttackEffects".)

VERDICT: PASS
