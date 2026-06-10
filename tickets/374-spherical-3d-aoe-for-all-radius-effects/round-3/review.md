# Senior Review — 374-spherical-3d-aoe-for-all-radius-effects

## Runtime health (gate)

The captured run is clean:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block, servers
  started on `http://localhost:5177/` and reached `phase: "playing"` with a live scene
  (`sceneInitialized: true`, `hasCanvas: true`, 2 players, 5 enemies).
- `console.log`: no `pageerror`/`[fatal]` lines from game code. The only `[A:error]` /
  `[B:error]` entries are HTTP 409 (benign auth/lobby contention) and the Vite/WS noise the
  rubric explicitly ignores. Scene initializes and ready-up completes for both clients.

Game runs and loads cleanly → gate passed.

## Acceptance criteria

**Make ALL AoE/radius checks 3D spherical (include dy) instead of XZ-only.**
Met. A single core helper `sphericalDistanceToEntity(originX, originY, originZ, entity)` plus
`resolveAoeOriginY` (falls back to floor Y at the XZ when origin Y is null — never to 2D)
were added in `simulation.js`, and every former `Math.hypot(dx, dz)` radius gate now routes
through 3D distance. Converted sites, all verified in the diff:
- Instant/radial: `collectRadialHits` (now takes `originY`), `applyFreezeInRadius`,
  `healPlayersInRadius`, `pullEnemiesToward`, `applyEventHorizon`.
- Cone: `collectConeHits` — the old `use3D` branch and the flat-cone `Math.abs(dy) >
  PROJECTILE_HIT_WIDTH` shortcut were removed; range is now always `Math.hypot(dx,dy,dz)` and
  the cone-angle test is a 3D dot product. A flat cone still correctly rejects a target
  directly overhead (dot → 0 < halfCos).
- Persistent area effects: `volatile_explosion` (enemies/minions/players), `inferno_pillar`,
  `fire_trail` / `dragons_breath` cone ticks — all now carry `originY`/`dirY` and gate in 3D.
- Ground enchantments (`updateEnchantments`, spike_trap/cinder_snare) store `y` and gate
  spherically; `triggerMirrorWard` passes the player Y.
- Chain lightning hops (`collectChainLightningHits` and the minion variant in `updateMinions`)
  are now unconditionally 3D.
- Key items (`keyItemEffects.js`): field_medic_kit heal, barrier_dome, smoke_bomb, rally_cry,
  recon_pulse reveal, loot_magnet inclusion — all spherical.
- Sacrificial altar `findSacrificeTarget` is spherical.

**Symmetric — both player-card AoE and enemy AoE.**
Met. Enemy side is converted too: `isEntityInEnemyAttack` now uses 3D range + 3D cone dot
(including `windupDirY`), `healFieldMedicAlly` (enemy field-medic) uses spherical distance,
`isPlayerConcealed` (smoke zone) and the `barrierDome` block test in `damagePlayer` are 3D
spheres for both victim and attacker. Cast origins record Y at cast time
(`originY`/`barrierDomeY`/`smokeBombY`) with floor fallback for older persisted state.

**Enumerate & test every AoE card at different heights + exclude out-of-sphere.**
Met. New suites cover the full enumerated set with explicit elevated-include /
XZ-close-but-too-high-exclude cases: `spherical_aoe_cards.test.js` (552 lines),
`spherical_radius_helpers.test.js`, `area_effects_spherical.test.js`,
`enemy_aoe_spherical.test.js`, `zone_effects_spherical.test.js`, plus additions to
`key-items.test.js`, `enchantment.test.js`, `chain_lightning.test.js`,
`field_medic_kit.test.js`, `loot_magnet.test.js`, `purifying_pulse.test.js`,
`barrier_dome.test.js`, `smoke_bomb.test.js`, `new_card_pack.test.js`. frost_nova,
glacier_collapse, inferno_pillar, purifying_pulse, event_horizon, gravity_well,
dragons_breath, and heal radius are each exercised at multiple heights.

**Prep for flying enemies.**
Met in spirit: all gates use `getEntityWorldY(entity)`, so an entity with a nonzero `y`
(a flying enemy) is naturally included/excluded by true 3D distance with no further change.

**Scope: game/server/simulation.js + game/server + test.**
Respected. Diff touches only `game/server/*.js` and `game/server/test/*` (plus subticket
bookkeeping files). No client/shared edits.

## Consistency & quality

- Consistent with `game/docs/design.md`: AoE remains server-authoritative; no gameplay-shape
  regression — only the height dimension is added to inclusion.
- No 2D fallback leaks: `resolveAoeOriginY` resolves null Y to the floor sample, so the
  conversion is total, not partial.
- Displacement semantics preserved where intended: `pullEnemiesToward`/loot_magnet gate
  inclusion in 3D but keep the pull/slide on the XZ plane (documented in comments) — correct,
  enemies/loot don't get yanked vertically.
- No debug scenarios were added or changed by this ticket.
- Full server suite: **2065/2065 pass**, including the 164 tests in the spherical-focused
  files. No regressions.

## Remaining gaps

None blocking. Acceptance criteria are fully and robustly met, the game runs cleanly, and the
test suite is green. Minor non-blocking polish noted in `nits.md`.

VERDICT: PASS
