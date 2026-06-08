## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `"ok": true`, the server/client logs show normal startup and shutdown, and `pageerrors` is empty. `console.log` contains no `pageerror` or `[fatal]` lines from game code.

## Acceptance criteria findings

### Each spell reads as visually distinct

Most of the ticket work satisfies the goal: the former generic-burst spell families now have bespoke renderers in `game/client/cardRenderers.js`, including frost, ice projectile, glacier, gravity, event horizon, fire breath, inferno pillar, chain lightning, arcane drains, and utility spells. The renderers use the 315 primitives (`spawnTelegraphRing`, `spawnProjectileTrail`, `spawnImpactDecal`, `spawnParticleBurst`) with element-appropriate palettes, and the live server payloads in `game/server/cardEffects.js` provide the expected `origin`, `radius`, `direction`, and chain/impact data.

However, the top-level criterion says per-card spell animations and that each spell should read as visually distinct. `healing_font` and `divine_grace` are both shipped `type: "spell"` cards and still resolve to the same `renderHealRestore` renderer. That renderer always calls `spawnDivineGraceEffect(origin, radius)` and only varies the heal sound based on `hpGained`, so Restoration Beacon and Sanctum Pulse have the same cast/impact visual despite being distinct base/evolved spell cards. The added test only proves every `CARD_DEFS` spell avoids the type default; it does not prove every spell has a distinct per-card signature.

### Generic-burst spells upgraded

The generic-burst upgrades are substantially complete. The registry now maps all `CARD_DEFS` spells away from `SPELL_TYPE_DEFAULT_RENDERER`, and focused tests cover the new helper calls. The default renderer remains only as the type fallback and test reference.

### No performance regression

No obvious performance regression was found. The added effects are event-triggered on card use, the particle helper honors the existing particle setting, and the full vitest run in `coverage.log` reports 120 test files and 1807 tests passing. The visual capture also completed a multiplayer lobby-to-run smoke flow.

### Tests where feasible

Coverage is appropriate for the renderer dispatch work: `game/client/test/cardRenderers.test.js` exercises the new per-card renderer calls, optional-helper fallbacks, and registry coverage. The missing test coverage is specifically around uniqueness for `healing_font` versus `divine_grace`.

### Design and requirements consistency

The implementation stays within the documented card-based combat model in `game/docs/design.md` and does not regress the foundational requirements in `game/docs/requirements.md`: the scene renders, the client connects to the server, players appear in 3D, and movement sync is shown in the capture probes.

### Debug scenarios

This ticket adds spell VFX debug scenarios in `game/server/debugScenarios.js` and registers them in `game/server/index.js`. They are gated through the existing debug scenario path rather than normal gameplay, and their comments and setup match states that remain reachable through normal card acquisition/evolution plus dungeon combat. The scenarios prepare hands/enemies for QA but still rely on the normal `useCard` server path for validation, cost/charge consumption, payload emission, and net replication.

## Remaining gaps

1. `healing_font` and `divine_grace` still share the exact same heal-ring renderer, so not every spell has a visually distinct per-card cast/impact animation.

VERDICT: FAIL
