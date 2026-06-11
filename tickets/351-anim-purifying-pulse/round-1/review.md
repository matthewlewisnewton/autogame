# Senior Review — 351-anim-purifying-pulse

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`. Servers
  started, scene initialized, full smoke flow (auth → lobby → ready → movement →
  dodge w/ cooldown probe) completed.
- `console.log`: no `pageerror`, no `[fatal]`, no uncaught exceptions — only
  benign Vite connect + initScene/launchBooth logs.
- Screenshot `02-after-w.png` shows a cleanly rendered scene, HUD, card hand.
- `npx vitest run` on the changed test files: **198 passed (198)** (client
  `cardRenderers.test.js` + server `purifying_pulse.test.js`).

Game runs cleanly — gate passes.

## Acceptance criteria

### AC1 — Animation visibly matches name/theme
**Met.** `renderPurifyingPulse` (game/client/cardRenderers.js:710+) now emits a
3-wave staggered set of concentric mint heal rings (`PURIFYING_PULSE_WAVE_COUNT`)
that each expand to the card's `radius`, producing a visible outward *pulse* — a
clear improvement over the prior single static ring. It adds an upward white→mint
"purifying rise" column via `spawnCleanseBurstEffect` (renderer.js:4807+),
reading as corruption lifted away. Palette is mint/white (`0x6ee7b7` /
`0xffffff` / emissive `0x5eead4`), deliberately distinct from Divine Grace's gold
— a dedicated test asserts purifying_pulse never emits the gold particle palette
or `spawnDivineGraceEffect`.

### AC2 — Timing synced to server effect resolution
**Met.** The server resolves `heal_and_cleanse` instantly in a single
`CARD_USED` emit (cardEffects.js:816-839) — no projectile/travel phase. The
client fires every primitive synchronously within `renderPurifyingPulse`; wave
stagger is baked into each ring's `createdAt` (`now + wave * 130ms`) rather than
`setTimeout`. A test spies `setTimeout` and asserts it is never called, proving
no timer-based desync. The future-`createdAt` mechanism is correct: in
`updateAttackEffects` (renderer.js:5890), a not-yet-due ring has negative
`elapsed`, so `expandT` clamps the scale to `0.001` (invisible) until its time
arrives, then it expands to full `radius` — bounded lifetime, no leak.

### AC3 — No perf regression
**Met.** Rings ride the existing radius-AoE `updateAttackEffects` branch; the
column rides the shared `isLightColumn` branch (same primitive as Sanctum
Pulse/telepipe) with no per-frame allocation. Three rings + one column + one
spark burst per cast is negligible and self-disposing. No new animation loop.

### AC4 — Client test where feasible
**Met, and thorough.** New/updated tests cover: ≥2 staggered waves at origin &
radius with distinct increasing wave indices; cleanse rise present; synchronous
(no setTimeout); never-gold; and notably a **sound-gating** test — heal cue
plays for the caster or a player in `healedTargets`, but a pure spectator gets
VFX without sound. Server emits `playerId` + `healedTargets`, matching exactly
what the client gating reads.

### Scope
**Respected.** Diff touches only `game/client/cardRenderers.js`,
`game/client/renderer.js`, and `game/client/test/cardRenderers.test.js` (plus
ticket bookkeeping) — within the declared scope.

### Design/regression consistency
Consistent with `game/docs/design.md` (heal/cleanse spell identity, mint palette
distinct from gold sanctum). No debug scenario added or changed by this ticket
(the existing `debugScenarios.js` purifying_pulse entry is untouched), so the
debug-scenario gate does not apply. No foundation regression.

## Remaining gaps
None blocking. The fallback smoke capture did not cast purifying_pulse itself
(deck/hand smoke flow), but the card's visual was validated at the sub-ticket
level, the runtime is proven healthy, and the rendering path is fully unit-tested
— this is a minor coverage observation, not a blocker.

VERDICT: PASS