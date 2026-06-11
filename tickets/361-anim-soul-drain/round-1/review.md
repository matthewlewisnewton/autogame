# Senior Review — 361-anim-soul-drain

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block. Servers
  started, page loaded (`sceneInitialized: true`, `hasCanvas: true`).
- `console.log`: clean — only Vite connect + `initScene` + booth ready-up lines. No
  `pageerror`/`[fatal]` from game code.
- `pageerrors.json`: empty. `server.log`: no errors.
- Game starts and loads cleanly. Gate PASSED.

Note: `capturePlanSource` is `"fallback"`, so the deterministic smoke flow was captured
rather than the `soul-drain-heal-ready` scenario; the four screenshots show lobby/move/dodge,
not the Soul Drain cast itself. This is a capture-plan limitation, not a code defect — the
run is clean and the effect logic is verified by unit tests below.

## Acceptance criteria

### Visual matches name/theme
PASS. `renderSoulDrain` (game/client/cardRenderers.js:909) now renders, on resolution:
- pink/magenta evolved telegraph ring + primary particle burst (`SOUL_DRAIN_COLOR 0xe879f9`),
- a **per-hit drain tether** drawn FROM each struck enemy's live mesh TO the caster's cast
  origin via `ctx.spawnLightningArc(enemyPos, origin, …)` — reads unmistakably as souls being
  pulled out of victims into the caster,
- a **life-absorb flourish** decal/burst at the caster origin.
This is a clear, on-theme upgrade over the prior generic burst-at-origin.

### Timing synced to server effect resolution
PASS. The renderer is driven by the `CARD_USED` broadcast (cardEffects.js:1173-1184), which
the server emits at effect resolution — i.e. after the `windUpMs: 700` wind-up (handled by the
shared 307 charge telegraph keyed off the stat, not duplicated here). The flourish is gated on
`data.hpHealed > 0`, and `hpHealed` is the *applied* heal from `healPlayer(...)`
(cardEffects.js:1163), so the heal visual only fires when the cast actually restored HP. Tethers
iterate `data.hits`, which is the authoritative radial-hit list (`{ enemyId, hp, … }` from
`collectRadialHits`, simulation.js:1739), so one tether per real hit. Soul Drain is an instant
radial drain (no DoT), so no lingering effect is owed.

### Robustness / edge cases
PASS. Hits whose enemy already despawned (no mesh) are skipped (`if (!mesh) continue`). All
primitive calls are guarded (`ctx.spawnLightningArc && ctx.enemyMeshes`, `ctx.spawnImpactDecal`
else `spawnParticleBurst`), so a minimal ctx renders without throwing — covered by the
"renders without throwing when new ctx primitives are absent" test. The per-hit loop is bounded
by enemies within `SUMMON_RADIUS`; no perf regression, reuses existing 315 VFX primitives.

### Client test (where feasible)
PASS. game/client/test/cardRenderers.test.js extends coverage: per-hit tether count +
endpoints + style, mesh-skip for despawned enemy, heal-flourish gating (both `hpHealed: 0` and
absent), and absent-primitive safety. Full suite: **165 passed**.

## Debug scenario validation (`soul-drain-heal-ready`)
PASS on all three required checks:
- **Dev-gated, sole entry**: added only to the `DEBUG_SCENARIOS` set (index.js:648) and the
  `applyDebugScenario` chain (debugScenarios.js:4970); the `?debugScenario=` path is the only
  way in. Normal gameplay never references it.
- **End-state reachable normally**: a damaged caster with full Magic Stones casting an evolved
  Soul Drain into a grunt cluster is ordinary combat — the scenario only pre-arranges that
  state; it does not auto-cast.
- **No invariant bypass**: the scenario only mutates state (hp, magicStones, one hand slot,
  enemy spawns). The actual cast still flows through the normal `useCard`/`cardEffects`
  validation, server resolution, and net replication.

## Design consistency
Consistent with game/docs/design.md: builds on the 315 shared VFX primitives
(`spawnLightningArc`, `spawnTelegraphRing`, `spawnParticleBurst`, `spawnImpactDecal`) and only
touches this card's render fn. No foundation regression.

## Remaining gaps
None blocking. The only out-of-strict-scope change is the server-side debug scenario (ticket
SCOPE names client paths); it is additive, properly gated, and a legitimate QA enabler — noted
in nits.md, not blocking.

VERDICT: PASS
