# Cryo Burst cast: explosive radial frost burst that reads as its name

Redesign the `frost_nova` ("Cryo Burst") client renderer so its cast reads
unmistakably as an *icy radial burst* — an expanding frost shockwave ring plus
a dense radial ice-shard particle burst and a frozen ground impact at the cast
origin, all in the ice palette. Replace the current minimal one-ring + small
burst with a richer composition while staying visually distinct from
`permafrost_lance` (forward lance) and `glacier_collapse` (fixed-palette summon).

## Acceptance Criteria

- `renderFrostNova` (in `game/client/cardRenderers.js`) still keys off
  `data.radius` and the cast `origin`, and bails out only when `data.radius`
  is undefined (current guard preserved).
- On cast it composes a clearly icy *burst* using shared VFX primitives:
  - an expanding frost shockwave / telegraph ring at the origin sized to
    `data.radius`,
  - a radial ice-shard particle burst at the origin with a higher shard
    `count` and wider `spread` than the previous version (visibly denser),
  - a frozen ground impact decal at the origin.
  All use the ice palette (accent color via `getAccentHex(data.cardId)`
  falling back to `ICE_ACCENT_COLOR` 0x67e8f9, emissive `ICE_ACCENT_EMISSIVE`
  0x38bdf8).
- The renderer must NOT call `spawnSummonEffect` (that primitive belongs to the
  generic summon look / `glacier_collapse`); Cryo Burst must remain distinct
  from `glacier_collapse`.
- `renderFrostNova` and `renderPermafrostLance` still resolve to different
  functions and produce a different set of primitive calls for an equivalent
  radial payload (existing distinctness tests keep passing).
- All effects fire synchronously inside `renderFrostNova` — no `setTimeout`,
  `scheduleAfter`, or async delay — matching the server's instant
  `frost_nova`-branch resolution (no wind-up, no projectile travel).
- No projectile/lance primitive is used (Cryo Burst is a self-centered burst,
  not a directional lance).
- A client test asserts the new primitive composition (shockwave ring at
  `radius`, denser radial burst, impact decal, ice palette) and that
  `spawnSummonEffect` is not called.
- Full client + server vitest suite passes; no perf regression (no new
  per-frame work, no unbounded particle counts).

## Technical Specs

- `game/client/cardRenderers.js`: rewrite `renderFrostNova` (around line 602).
  Compose `ctx.spawnTelegraphRing(origin, data.radius, { color, emissive })`,
  a denser `ctx.spawnParticleBurst(origin, { color, emissive, count, spread })`
  (raise count/spread from the current `count: 14, spread: 2.0`), and
  `ctx.spawnImpactDecal(origin, { color, emissive })`. Keep using the existing
  `ICE_ACCENT_COLOR` / `ICE_ACCENT_EMISSIVE` constants and `getAccentHex`
  helper. Keep the function registered as `frost_nova: renderFrostNova` (around
  line 2044) — do not change the registration table key.
- Available `ctx` VFX primitives (wired in `game/client/main.js` ~1397–1421):
  `spawnTelegraphRing`, `spawnParticleBurst`, `spawnImpactDecal`,
  `spawnProjectileTrail`, `spawnAttackEffect`, etc. Use only burst-appropriate
  ones (ring + burst + decal). If a richer dedicated burst primitive is needed,
  it may be added to `game/client/renderer.js` and exported/wired in `main.js`,
  but reuse existing primitives first.
- `game/client/test/cardRenderers.test.js`: update / extend the existing
  `frost_nova adds an icy telegraph ring and radial frost burst...` test
  (around line 1378) to assert the new composition (impact decal present,
  denser burst, no `spawnSummonEffect`). Keep the existing distinctness tests
  (`frost_nova and permafrost_lance ...`) green.
- Do NOT touch the server, `cardEffects.js`, `cardStats.json`, or any other
  card's renderer.

## Verification: code
