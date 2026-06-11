# Resonance Edge: resonant-blade theme + shockwave-cadence sync

Re-theme the Resonance Edge (`resonance_edge`) weapon resolution VFX so it reads
unmistakably as a *resonant / harmonic sonic blade* whose energy builds and then
**discharges as a resonance shockwave on the cadence the server actually fires
it** (every 2nd use). Today `renderResonantDoublePulse` plays the same magenta
double-pulse on every swing and never keys off the real shockwave cadence, so the
signature "resonance peak" is invisible and the timing does not match the effect.
All built from the existing 315 VFX primitives, touching only this card's renderer
+ its test.

## Background (verified, do not re-derive)

- Server emits `CARD_USED` for `resonance_edge` from the weapon branch in
  `game/server/cardEffects.js` (~line 549) with: `cardId`,
  `specialEffect: 'shockwave'`, `origin: { x, z }`, `direction`, `attackRange`,
  `attackConeAngle`, `hits`, `comboCount`, and **`shockwaveHits`**.
- `shockwaveHits` is the heart of the timing contract: `cardStats.json` gives
  `resonance_edge` `shockwaveEvery: 2`, `shockwaveRadius: 6`, `shockwaveDamage: 33`.
  The server only collects radial shockwave hits when
  `comboCount % shockwaveEvery === 0`, so **`data.shockwaveHits` is a NON-EMPTY
  array on every 2nd use and an empty array (`[]`) on the other uses.** The
  renderer's resonance discharge MUST be gated on `data.shockwaveHits?.length > 0`
  so its on-screen cadence matches the server, never faked on every swing.
- The weapon is **instant**: no `windUpMs` (so NO 307/315 wind-up charge
  telegraph applies to this card), no projectile travel, and no DoT. Do NOT add a
  projectile-travel renderer, a charge telegraph, or a DoT — there is nothing to
  delay the swing against. The swing reads immediately.
- The shared post-effect `applyShockwave` (`cardRenderers.js` ~line 1738) already
  spawns a generic `spawnSummonEffect(origin, 6, accentHex)` + hit sound whenever
  `data.shockwaveHits` is non-empty. It is shared/out-of-scope — **do not modify
  it.** The renderer's themed discharge layers ON TOP of it; do not duplicate that
  exact summon ring.
- Current accent palette stays: `color 0xe879f9` (magenta), `emissive 0xc026d3`.

## Acceptance Criteria

- `renderResonantDoublePulse` (`cardRenderers.js` ~line 408) still spawns the
  magenta resonant cone swing via `ctx.spawnAttackEffect(origin, direction, …)`
  using `color 0xe879f9` / `emissive 0xc026d3` and a directional cone (keep the
  `coneAngle` ≈ `Math.PI / 3.5`, `range` ≈ 5), so it reads as a blade slash.
- On EVERY use the renderer still emits its base "resonance ringing" — at least
  one immediate `spawnTelegraphRing` resonance pulse at the existing palette, plus
  a second expanding pulse a beat later via `ctx.scheduleAfter` (the harmonic
  after-ring). The base pulses are the same regardless of shockwave cadence.
- A distinct **resonance discharge** layer is spawned ONLY when
  `data.shockwaveHits?.length > 0`: an additional, visibly larger themed effect at
  the cast origin — e.g. one or more expanding `spawnTelegraphRing` rings sized to
  the shockwave radius (≈ 6, clearly larger than the base ~1.6–2.6 pulses) and/or a
  heavier `spawnParticleBurst` — conveying the resonance peaking and bursting
  outward. When `data.shockwaveHits` is empty (`[]`), `undefined`, or absent, NO
  discharge layer is spawned (the swing + base ringing only).
- Because the discharge is gated on `data.shockwaveHits`, its on-screen cadence
  matches the server's every-2nd-use shockwave; the renderer does NOT key the
  discharge off `comboCount` arithmetic or fire it on every swing.
- No projectile-travel, wind-up-charge, or DoT VFX are added — the swing and any
  discharge resolve immediately (the discharge may use the existing scheduled
  after-beat, but there is no travel delay).
- Every `ctx.*` call is guarded so the renderer never throws when a primitive
  (`spawnAttackEffect`, `spawnTelegraphRing`, `spawnParticleBurst`,
  `scheduleAfter`) is absent — the existing energy-blade graceful-degradation test
  (`cardRenderers.test.js` ~line 818, ctx with those primitives `undefined`) still
  passes for `resonance_edge`.
- No other renderer changes: `applyShockwave`, `renderEchoSlash`, the
  `CARD_RENDERERS` registration (`resonance_edge: renderResonantDoublePulse`,
  ~line 1621), and the accent palette stay as-is. The five-energy-blade
  distinct-accent test (~line 806) still passes.
- `game/client/test/cardRenderers.test.js`: the existing "Resonance Edge slashes
  magenta and rings twice…" test (~line 770) is updated so its `data` carries
  `shockwaveHits: []` (the common non-discharge swing) and it still asserts the
  magenta cone + the two scheduled base pulses with NO discharge layer; ADD a new
  case firing `resonance_edge` with a non-empty `shockwaveHits` that asserts the
  larger resonance-discharge effect appears (e.g. an extra ring near radius ~6
  and/or a heavier burst that is absent in the `shockwaveHits: []` case).
- `cd game && pnpm test:quick` passes (server + client vitest); no perf
  regression (the discharge is gated, adding nothing on non-shockwave swings).

## Technical Specs

- `game/client/cardRenderers.js`:
  - Rewrite `renderResonantDoublePulse` (~line 408). Keep the magenta
    `spawnAttackEffect` cone swing and the immediate + `scheduleAfter` base
    telegraph-ring pulses (the "resonance ringing"). Add a guarded discharge block
    `if (data.shockwaveHits && data.shockwaveHits.length > 0) { … }` that spawns a
    larger themed resonance burst at `originOf(data)` — one/two expanding
    `spawnTelegraphRing` rings at the shockwave radius and/or a stronger
    `spawnParticleBurst` — all using the existing `color`/`emissive`. Do NOT
    re-spawn the generic `spawnSummonEffect(origin, 6, …)` that `applyShockwave`
    already provides.
  - Keep every `ctx.spawn*` / `ctx.scheduleAfter` call behind an existence guard
    (matching the current `if (ctx.spawnTelegraphRing) …` / `if (ctx.spawnParticleBurst) …`
    pattern) so the no-primitives ctx never throws.
  - Do not touch `applyShockwave`, `renderEchoSlash`, the registration table, or
    `getAccentHex`.
- `game/client/test/cardRenderers.test.js`: update the existing `resonance_edge`
  test (~line 770) to pass `shockwaveHits: []` and assert no discharge layer; add a
  sibling test firing with `shockwaveHits: [{ enemyId: 'e1' }]` asserting the
  discharge ring/burst is present. Reuse the existing `fire`/`makeCtx`/`swingStyle`
  helpers. Ensure the graceful-degradation case (~line 818) and the distinct-accent
  case (~line 806) still cover `resonance_edge`.

## Verification: code
