# Senior Review — 325-anim-bulkhead-mauler

## Runtime health (blocking gate)

PASS. The captured run is clean:
- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`, dev
  servers started (`url` reachable, `sceneInitialized: true`, `hasCanvas: true`).
- `console.log`: 8 lines, no `pageerror`/`[fatal]`/uncaught entries.
- Screenshots render the full game (HUD, 3D scene, card hand, player avatar) —
  no black screen, gameplay (movement, dodge cooldown HUD) works.

Note: the capture used the deterministic full-flow smoke fallback
(`capturePlanSource: "fallback"`), so it does not visually exercise the
Bulkhead Mauler animation itself. The animation is instead validated by the
unit suite (267 client + 40 vfx + 16 server tests, all green) and by code
inspection of the live working tree below. The run proves the game loads and
runs cleanly with the ticket applied, which is the runtime-health requirement.

## Acceptance criteria

### Visual matches name/theme
MET. `bulkhead_mauler` now registers `[renderBulkheadMaulerSummon,
renderBulkheadMaulerShockwaveSweep]` (was a single bare shockwave fn).
- Palette: slate stone chassis `0x78716c` + amber forge glow `0xf59e0b`
  (`BULKHEAD_MAULER_COLOR/EMISSIVE`), consistent across renderer.js and
  cardRenderers.js.
- Deploy: expanding slate/amber assembly ring + a short rising *tapered
  bulkhead slab* (cylinder, wider base) + shared minion summon-in flourish —
  reads as a heavy stone construct assembling.
- Attack: a brief ground-hugging stone wedge (CircleGeometry sector + edge
  boundary + rim) expanding along the server direction, plus a foot-level
  debris burst and per-hit sparks. Thematically a short wide ground shockwave,
  matching "Mauler."

### Timing synced to server effect resolution
MET. `cardStats.json` defines no `windUpMs` for `bulkhead_mauler`, so there is
no charge telegraph to honor; both VFX fire synchronously off the server event:
- Deploy fires on the creature CARD_USED that carries `minionId` (server emit
  at `cardEffects.js:1393`, no `direction`, no `hits`).
- Shockwave fires on the minion's `_pendingMinionBreaths` CARD_USED with
  `specialEffect:'shockwave_sweep'`, `direction`, `hits` (`simulation.js:3711`),
  matching the instant server cone resolution (`collectConeHits`) — no fake
  projectile travel. `range`/`coneAngle` are taken from the server payload.

### Deploy vs attack discrimination (robustness)
MET — and this is the genuinely tricky part. The real server *deploy* payload
includes `specialEffect: cardDef.specialEffect` (= `'shockwave_sweep'`) because
that field is copied from the card def. The discrimination handles it:
- `renderBulkheadMaulerSummon` guards `!data.minionId || data.direction` → fires
  on deploy (minionId, no direction), bails on attack (has direction).
- `renderBulkheadMaulerShockwaveSweep` guards on `specialEffect==='shockwave_sweep'
  && origin`, then additionally requires `direction` OR non-empty `hits` → bails
  on the deploy event (no direction, no hits) and fires only on the attack.
The test suite explicitly covers the deploy-payload-with-specialEffect case and
the real CARD_USED shapes for both deploy and attack.

### No double-render of the shockwave
MET. `renderCardUsed` always runs `applyHitFlashes`, which calls
`markCardHitEnemies(hits)`; the `CARD_HIT_GRACE_MS` (500ms) window in
`enemySync.js` then suppresses the `MINION_HIT_VFX[bulkhead_mauler]` fallback
for those enemies, so the breath CARD_USED draws the wedge once. The
`enemySync` fallback (now also using `spawnBulkheadMaulerShockwaveEffect`, with
`minion.attackRange/attackConeAngle`) only fires for un-attributed HP drops.

### No perf regression
MET. All new meshes are pushed to `activeEffects` with bounded `duration` and
cleaned up via `disposeEffectObject` on expiry; materials use `depthWrite:false`
additive overlays. No per-frame allocation churn beyond the standard effect
lifecycle.

### Client test where feasible
MET. cardRenderers.test.js + vfx-primitives.test.js add coverage for renderer
composition, palette, deploy/attack discrimination, real server payload shapes,
and graceful degradation when optional primitives are absent.

## Debug scenario (`bulkhead-mauler-ready`)
OK on all three checks:
- Gated: only reachable via the `DEBUG_SCENARIOS` set + `debugScenario` URL path;
  normal gameplay never invokes `setupBulkheadMaulerReadyDebug`.
- Normal path intact: the scenario only tops up hp/mana and inserts the reward
  creature into hand; `bulkhead_mauler` is `acquisition:"reward", rewardOrder:13`,
  earnable in normal play, and the actual deploy still goes through
  `executeUseCard` (server validation, minion spawn, net replication unchanged).
- No invariant short-circuit: it stocks the hand and clears the stage; it does
  not bypass cost/validation.

## Consistency with design / foundation
Uses the 315 shared primitives (`spawnMinionSummonInEffect`, `spawnParticleBurst`,
`spawnHitSpark`) and the 316-319 per-card registration pattern (Battery Automaton
is the structural sibling). Scope stayed within this card: cardRenderers.js (its
fns + registration), renderer.js (its two primitives), the ctx wiring, the
`enemySync` fallback entry for this minion only, and a debug scenario. No other
card's renderer was touched.

## Remaining gaps
None blocking. One minor nit recorded in nits.md (overlapping per-hit spark
sources on the shockwave). It does not affect correctness or the verdict.

VERDICT: PASS
