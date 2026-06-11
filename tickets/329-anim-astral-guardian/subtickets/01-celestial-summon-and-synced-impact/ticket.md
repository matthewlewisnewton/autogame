# Astral Guardian — celestial guardian summon + server-synced impact

Rebuild `renderAstralGuardian` so the cast reads unmistakably as an **astral
guardian materializing** — a celestial sentinel summoning in at the caster with
a starlight/indigo palette — and so the radial burst lines up with the
server's instant resolution (no wind-up). Replace the generic summon flourish
with a proper minion summon-in plus an impact-synced telegraph at the exact
server `SUMMON_RADIUS`.

## Acceptance Criteria

- `renderAstralGuardian` summons the guardian via `ctx.spawnMinionSummonInEffect`
  (the dedicated minion materialize primitive) at the cast `origin`, instead of
  the generic `ctx.spawnSummonEffect`, using the astral indigo/violet palette
  (`ASTRAL_GUARDIAN_COLOR` `0x818cf8`, `ASTRAL_GUARDIAN_EMISSIVE` `0x6366f1`).
- A telegraph ring is still spawned via `ctx.spawnTelegraphRing` at the cast
  `origin` with radius **exactly equal to `data.radius`** (the server
  `SUMMON_RADIUS`), tinted with the astral palette — so the visible AoE matches
  where the server applied radial damage.
- A celestial "starlight" particle burst is spawned via
  `ctx.spawnParticleBurst` at the cast origin with the astral palette.
- The effect fires **synchronously at cast** — no `ctx.scheduleAfter` /
  `setTimeout` delay — because the server resolves Astral Guardian instantly
  (the card has no `windUpMs`).
- The renderer still no-ops cleanly when `data.radius` is `undefined`, and does
  not throw when optional ctx primitives (`spawnTelegraphRing`,
  `spawnParticleBurst`, `spawnMinionSummonInEffect`) are absent.
- A client test in `game/client/test/cardRenderers.test.js` asserts the new
  call set: `spawnMinionSummonInEffect` at origin with the astral palette, the
  telegraph ring radius equals `data.radius`, the particle burst palette, and
  that no `scheduleAfter` deferral is used.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`: rewrite `renderAstralGuardian(data, ctx)`
  (around line 2525) and keep its registration entry `astral_guardian:
  renderAstralGuardian` in `CARD_RENDERERS`. Swap `ctx.spawnSummonEffect(origin,
  1.2, …)` for `ctx.spawnMinionSummonInEffect(origin, { color, emissive,
  radius, burstCount, burstSpread })`. Reuse the existing
  `ASTRAL_GUARDIAN_COLOR` / `ASTRAL_GUARDIAN_EMISSIVE` constants and the
  `getAccentHex(data.cardId)` fallback already in the function. Preserve the
  `originOf(data)` origin resolution and the `data.radius === undefined` guard.
- `ctx.spawnMinionSummonInEffect` signature: `(origin, { color, emissive,
  radius, burstCount, burstSpread })` — see
  `game/client/renderer.js:4548`. It internally composes a summon ring,
  telegraph, and burst, so tune `radius`/`burstCount` for a tight guardian
  spawn distinct from the wider AoE telegraph.
- Do NOT add any delayed scheduling; Astral Guardian has no `windUpMs` in
  `game/shared/cardStats.json` (instant resolution in
  `applyAstralShieldCast`).
- `game/client/test/cardRenderers.test.js`: update/extend the existing
  `astral_guardian` test (around line 3093) to match the new call set.
- Do not touch the server, the minion mesh, or any other card's renderer.

## Verification: code
