# Senior Review — 342-anim-arcane-bolt

## Runtime health (blocking gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`, servers started, scene initialized (`sceneInitialized: true`, two canvases).
- `console.log`: clean — only `[vite] connecting/connected`, `initScene`, and `launchBooth` logs. The single `409 (Conflict)` on a resource load is a benign lobby/auth resource race, not a game-code page error or fatal.
- Screenshot `02-after-w.png` confirms the game renders gameplay correctly (HUD, hand, 3D scene).
- The fallback smoke capture used a deck without `arcane_bolt`, so the bolt VFX is not directly shown on screen; runtime health is nonetheless proven and the animation behavior is fully covered by unit tests.

**Game runs cleanly → runtime gate passes.**

## Acceptance criteria

### "Animation visibly matches its name/theme" — MET
`renderArcaneBolt` (game/client/cardRenderers.js) + the `arcane_bolt` branch in `spawnAttackEffect` (game/client/renderer.js) replace the previous generic `renderWeaponSwing`. The card now spawns:
- A violet energy **lance** projectile: an elongated `ConeGeometry` core (`0.08 × 1.45`) plus a trailing glow cone, tinted `#a78bfa` accent color with `0x7c3aed` emissive — visually distinct from generic `projectile` spheres and ground cone wedges. Accent matches `CARD_ACCENT_STYLE.arcane_bolt` (`cards.js:148`).
- A cast channel (`spawnTelegraphRing` + 8-particle `spawnParticleBurst`) at the origin, and a `spawnProjectileTrail` streak.
- `updateAttackEffects` animates travel along direction with emissive flicker/pulse and a life-ratio fade. Thematically reads unmistakably as an "Arcane Bolt".

### "Timing synced to server effect resolution" — MET
The server (`cardStats.json:170`) defines `arcane_bolt` as `effect: "projectile"`, `attackRange: 10`, `projectile.pierces: true`, with **no `windUpMs`**. The renderer mirrors this:
- **No wind-up telegraph** (instant cast) — correct; a regression test asserts `windUpMs ?? 0 <= 0`.
- **Per-enemy pierce bursts fire immediately** on CARD_USED via the `data.hits` loop at enemy mesh positions — aligns with the server's instant `collectProjectileHits` resolution and honors `pierces: true`.
- **Terminal max-range impact** (`spawnImpactDecal` + 16-particle burst) deferred by `travelMs` via `scheduleAfter`, for visual travel sync only.
This is a faithful match to instant projectile resolution.

### "No perf regression" — MET
The projectile effect is registered in `activeEffects` and disposed on expiry (`disposeEffectObject` + array splice once `elapsed >= duration`). A vfx-primitives test confirms the flagged lance is added and cleaned up with geometry disposal. No persistent leaks.

### "Client test where feasible" — MET
`cardRenderers.test.js` and `vfx-primitives.test.js` add coverage: renderer resolution (`renderArcaneBolt`, explicitly not `renderWeaponSwing`), synced `spawnAttackEffect`/`spawnProjectileTrail` params, deferred terminal impact via `runScheduled`, immediate per-hit pierce bursts at mesh positions (with a missing-mesh guard), no-windUp assertion, and projectile lifecycle/cleanup. Ran `vitest run` on both files: **237 passed (237)**.

### Scope — RESPECTED
Diff touches only `game/client/cardRenderers.js`, `game/client/renderer.js`, and the two client test files — exactly the declared scope. No server, no other per-card renderers, no debug scenarios added.

## Consistency / regressions
- Consistent with `design.md` (Weapons = directional projectiles). No foundation regression.
- No debug-scenario shortcuts introduced.
- Removed the now-dead `arcane_bolt` entry from `WEAPON_SLASH_STYLES`, avoiding stale config.

## Remaining gaps
None blocking. The implementation fully and robustly satisfies the ticket.

VERDICT: PASS