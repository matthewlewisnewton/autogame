# Senior Review — 347-anim-glacial-orb (Glacial Orb / ice_ball animation)

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `"pageerrors": []`, servers started, scene initialized,
  canvas present. `capturePlanSource: "fallback"` (deterministic full-flow smoke).
- `console.log`: no `pageerror`, no `[fatal]`, no uncaught exception from game code.
- Screenshots render the world cleanly (e.g. `02-after-w.png`).
- **PASS the runtime gate.** Note: the fallback deck contains no `ice_ball`, so the
  capture does not show the orb in flight. Visual proof for the orb itself comes from
  the three sub-tickets (each already passed visual QA) plus code review and the new
  client tests; runtime cleanliness is confirmed independently.

## Scope
Diff (`git diff 59a3d234..HEAD`) touches only `game/client/cardRenderers.js`
(`renderIceBall` + registration), `game/client/renderer.js` (the `ice_ball`
`spawnAttackEffect` branch + `updateAttackEffects` projectile tick), and the two
client test files. Squarely within the ticket's declared SCOPE; no server/shared
gameplay files changed.

## Acceptance criteria

### AC1 — Animation visibly matches name/theme ("Glacial Orb")
Met. The projectile is rebuilt as a faceted `IcosahedronGeometry` crystalline core
plus a translucent `SphereGeometry` frost halo (a `THREE.Group`), in a cool cyan
(`0x67e8f9`) / sky-blue emissive (`0x38bdf8`) palette. `updateAttackEffects` adds a
slow rotation + pulse/shimmer on the core and a breathing halo, giving a layered icy
silhouette distinct from the warm `fireball` sphere and the elongated
`permafrost_lance`. Cast is accented with a frost telegraph ring + small particle
channel. Accent color flows from `getAccentHex(cardId)` with sensible fallbacks.

### AC2 — Timing synced to server effect resolution
Met. The server (`cardEffects.js:1008`) resolves `ice_ball` instantly (hitscan
`collectProjectileHits` + `applySlow`) and emits `CARD_USED` with `origin`,
`direction`, `attackRange`, `hits`, and `projectileTravelMs`. The renderer:
- drives projectile travel and the deferred terminal impact (decal + freeze burst)
  off `projectileTravelMs` (`data.projectileTravelMs ?? 1200`, matching the card
  stat of 1200), via `scheduleAfter(travelMs, …)` — impact no longer fires
  synchronously at cast;
- spawns per-enemy frost bursts immediately at each hit enemy's mesh, aligning with
  the server's *instant* damage/slow application;
- correctly emits **no** wind-up charge telegraph — `ice_ball` has no `windUpMs`
  (verified in `cardStats.json`), so the "307 telegraph if windUpMs" clause does not
  apply; the brief cast frost channel is the right substitute for an instant spell.

### AC3 — No perf regression
Met. The projectile is one `Group` with two child meshes; on expiry it is removed
and disposed via `disposeEffectObject`, whose `mesh.traverse(...)` correctly disposes
both child geometries and materials (no leak from the Group switch). Per-frame work is
a handful of trig/scale updates. `depthWrite: false` on the translucent halo avoids
sorting artifacts.

### AC4 — Client test where feasible
Met and strong. New/updated tests assert: `resolveRenderers('ice_ball')` →
`renderIceBall`; cast flourish (telegraph ring + 8-count burst); trail carries
`travelMs`; terminal impact is **deferred** (not fired at cast) and lands at the
correct point after `runScheduled()`; immediate per-hit frost bursts at enemy mesh
positions with missing-mesh skip; instant-cast (no positive `windUpMs`); graceful
degradation when optional ctx primitives are absent; and a `spawnAttackEffect`
integration test verifying the glacial-orb group, colors, flag, and cleanup.
Ran `vitest run cardRenderers.test.js vfx-primitives.test.js` → **227 passed**.

## Consistency / regression
Consistent with the 315 VFX-primitive + per-card-renderer foundation (uses
`spawnTelegraphRing`, `spawnParticleBurst`, `spawnProjectileTrail`, `spawnImpactDecal`,
`spawnHitSpark`, `scheduleAfter`, `enemyMeshes` — all present in the `cardRenderCtx`
built in `socketHandlers/cardHandlers.js`). No debug scenario added/changed. No
gameplay, server, or shared logic touched, so no foundation regression.

## Remaining gaps
None blocking. Minor visual nits recorded in `nits.md`.

VERDICT: PASS
