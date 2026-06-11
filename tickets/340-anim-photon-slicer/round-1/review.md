# Senior Review — 340-anim-photon-slicer

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block. Servers started, scene initialized (`sceneInitialized: true`, `hasCanvas: true`), two players reached `phase: "playing"`.
- `console.log`: no `pageerror` / `[fatal]` lines from game code. The only `[error]` is a `409 Conflict` on a resource fetch during the auth/lobby race — benign infra noise, not a game-code defect; both clients proceed to init the Three.js scene and ready up.
- The fallback smoke capture does not cast cards, so Photon Slicer's disc is not in a screenshot, but the runtime-health requirement (game starts and loads cleanly) is satisfied.

## Ticket goal
Re-theme Photon Slicer so its visual matches its name (a thrown, returning photon disc) and its timing syncs to the server's `returning_projectile` effect. Previously it rendered as a stationary melee cone via `renderWeaponSwing` — a clear name/theme mismatch.

## Per-criterion findings

**Dedicated returning-disc renderer registered (not swing/cone).**
`CARD_RENDERERS.photon_slicer` now → `renderReturningDisc` (cardRenderers.js:2203). New function added at 623–660. PASS.

**Cyan outbound disc via `spawnAttackEffect`.**
`renderReturningDisc` calls `ctx.spawnAttackEffect(origin, direction, { color, emissive })` with `color = getAccentHex('photon_slicer') ?? 0x22d3ee`. Accent is `#22d3ee` (cards.js:146), so the disc is cyan; emissive `0x06b6d4`. PASS.

**Range from payload `attackRange` with finite fallback; trail + far-point burst.**
`range = Number.isFinite(data.attackRange) ? data.attackRange : RETURNING_DISC_RANGE(6)`. photon_slicer emits `attackRange: 8` (cardStats.json:158). Forward `spawnProjectileTrail(origin, direction, {range,…})` and `spawnParticleBurst(farPoint, …)` emitted. PASS.

**At least one boomerang return beat; defaults to 1 (not 0).**
`passes = Math.max(1, data.returnPasses ?? 1)`. photon_slicer omits `returnPasses`, so one return beat is scheduled. Each beat sends a trail from `farPoint` along the reversed direction and a burst at the origin. This is the critical divergence from `renderTripleReturning` (which uses `?? 0`) and is implemented correctly. Crucially, it matches the server: `collectReturningProjectileHits` uses `Math.max(1, options.returnPasses || 1)` (simulation.js:2097), i.e. exactly one return pass for photon_slicer — client and server agree. PASS.

**Cadence derived from `ATTACK_EFFECT_DURATION`.**
Uses `INFINITE_DISK_RETURN_BEAT_MS = round(ATTACK_EFFECT_DURATION/3)` (cardRenderers.js:548) — no fixed multi-second delay; the throw+return flourish resolves within the attack-effect window. No `windUpMs` on photon_slicer, so no charge telegraph is required. PASS.

**Graceful degradation.**
`spawnProjectileTrail`, `spawnParticleBurst`, and `scheduleAfter` are each guarded; only `spawnAttackEffect` is unconditional (consistent with sibling renderers and the always-present primitive). Calling with all optional primitives absent does not throw. PASS.

**Dead `WEAPON_SLASH_STYLES.photon_slicer` removed.**
Removed (former lines 182–193); other weapon styles untouched. PASS.

**Tests updated and passing.**
The old cone-slash assertion is replaced by a returning-disc test asserting the cyan outbound effect, far-point burst at `{x:8,z:0}`, exactly one scheduled return beat, and a reversed return trail after `runScheduled()`. `npx vitest run client/test/cardRenderers.test.js` → 212/212 pass, including the shared distinct-accent / graceful-degradation / card-specific-renderer tests with `photon_slicer` included.

**Scope.**
`git diff` touches only `game/client/cardRenderers.js`, `game/client/test/cardRenderers.test.js`, and the subticket md — within the declared scope. Server CARD_DEFS unchanged, so server tests referencing photon_slicer (`saber_aoe_grind`, `new_card_pack`) are unaffected.

## Design / regression consistency
Mirrors the established `renderTripleReturning` (Infinite Disk, photon_slicer's evolution) as its single-disc sibling — visually coherent across the lineage. No new ctx methods, no `renderer.js`/`main.js` changes, no foundation regression. No debug-scenario changes in this ticket.

## Remaining gaps
None blocking. Minor non-blocking nits filed separately (duplicate range constant, redundant accent fallback).

VERDICT: PASS
