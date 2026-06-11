# Senior Review — 358-anim-phase-echo

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`, `sceneInitialized: true`, two players reached `phase: "playing"`.
- `console.log` (8 lines) is clean: vite connect, `initScene`, `launchBooth ready-up`. No `pageerror`, no `[fatal]`, no uncaught exceptions.
- Client test suite: `cardRenderers.test.js` — **174/174 pass**.

The game starts and loads cleanly. Gate passes.

## Scope

`git diff c080e4e6..HEAD` touches exactly two files, both in the ticket's declared scope:
- `game/client/cardRenderers.js` — `renderEchoSlash` only (registration at line 1691 unchanged).
- `game/client/test/cardRenderers.test.js` — added coverage.

No debug scenarios added (`grep debugScenario` on the diff is empty), no server/shared changes, no out-of-scope churn.

## Acceptance criteria

### "Animation visibly matches its name/theme" — MET
Phase Echo renders as a pink (`0xf472b6`) twin-slash: a lead cone swing plus a fainter
after-image swing scheduled 150 ms later via `scheduleAfter`, with a pink projectile-trail
streak on each pass. This reads unmistakably as a "phasing echo" for a weapon card. On the
server's every-3rd-use shockwave cadence it layers an expanding telegraph ring sized to the
shockwave radius plus a heavy 24-particle burst and a larger after-ring (×1.4 at +90 ms) — a
distinct, much heavier "discharge" clearly separable from the base twin-slash. Thematic and
on-theme.

### "Timing synced to server effect resolution" — MET
- echo_blade has **no `windUpMs`** (`cardStats.json:303-309`), and the server resolves the
  swing + shockwave synchronously in `cardEffects.js`. The client fires the lead swing
  immediately and the shockwave alongside it — correct, no spurious wind-up telegraph.
- The shockwave layer is gated on `data.shockwaveHits.length > 0`. The server populates
  `shockwaveHits` only when `nextCount % cardDef.shockwaveEvery === 0`
  (`cardEffects.js:474-490`, `shockwaveEvery: 3`), so the visual cadence is driven by the
  server's own signal rather than client-side combo arithmetic. This is the same contract the
  sibling 359/resonance_edge ticket established and is consistent across both cards.

### "Use the 315 primitives; degrade gracefully" — MET
Every primitive call (`spawnAttackEffect`, `spawnProjectileTrail`, `scheduleAfter`,
`spawnTelegraphRing`, `spawnParticleBurst`) is guarded with an `if (ctx.fn)` check. The
"degrades when a primitive is absent" test fires both `resonance_edge` and `echo_blade` on the
shockwave-cadence path with a bare ctx and asserts no throw — green.

### "No perf regression" — MET
The shockwave path runs only on the 1-in-3 cadence and adds a bounded set of primitive calls
(two rings + one burst). No per-frame work, no allocations in a hot loop. Negligible.

### "Client test where feasible" — MET
Three new focused tests: off-cadence (empty `shockwaveHits` → no large ring / burst),
on-cadence (ring sized to radius, larger after-ring, ≥20-particle burst, pink color), and
radius fallback to 6. Plus the graceful-degradation extension. All pass.

## Code quality

Clean, well-commented, idiomatic with the surrounding styled-blade renderers. No dead/broken
code beyond the minor `shockwaveRadius` observation below (a nit, not a defect — the fallback
yields the correct value).

## Remaining gaps

None blocking.

Two non-blocking nits recorded in `nits.md`:
1. The server's `CARD_USED` payload never includes `shockwaveRadius`, so the client's
   `Number.isFinite(data.shockwaveRadius) ? … : 6` branch always takes the fallback. It happens
   to equal echo_blade's real radius (6), so the visual is correct, but the dynamic branch is
   effectively unreachable in production.
2. The shockwave VFX is gated on `shockwaveHits.length > 0`, so on the every-3rd-use beat with
   no enemy in radius nothing renders even though it is the cadence beat. Acceptable (the
   server shockwave is a no-op without hits, and this matches the sibling card), but worth a
   look if a "discharge always shows" feel is desired.

VERDICT: PASS