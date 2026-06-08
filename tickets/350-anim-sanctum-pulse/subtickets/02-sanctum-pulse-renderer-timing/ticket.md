# Sanctum Pulse — renderer integration, timing sync & tests

Update the `renderDivineGrace` card renderer to drive the reworked divine "pulse"
primitive with a coherent holy-gold palette, confirm its timing is synced to the
server's instant heal resolution, and lock the behavior down with client tests.
Depends on sub-ticket 01 (the reworked `spawnDivineGraceEffect`).

## Acceptance Criteria

- `renderDivineGrace` continues to fire the animation synchronously when the
  `divine_grace` CARD_USED event is handled — i.e. the pulse plays at cast time
  with NO projectile-travel delay, matching the server, which resolves
  `divine_grace` instantly (self-heal `healAmount` + `mana_restore`, no windUp,
  no projectile, no DoT in `cardEffects.js`). No artificial `setTimeout`/delay is
  introduced.
- The accent/particle palette used by `renderDivineGrace` (its
  `DIVINE_GRACE_COLOR` / `DIVINE_GRACE_EMISSIVE` and the `spawnParticleBurst`
  call) is gold/holy and stays visually distinct from Restoration Beacon
  (`healing_font`, green) and Purifying Pulse (`purifying_pulse`, mint).
- The heal sound still plays ONLY when `data.hpGained > 0` AND
  `data.playerId === ctx.myId`.
- The existing radius-absent guard is preserved: when `data.radius` is
  undefined, no VFX/primitive calls fire.
- The `divine_grace` entry in the renderer registry (cardRenderers.js) still
  resolves to `renderDivineGrace` (registration mapping unchanged / intact).
- No perf regression and the full client + server vitest suite passes.
- Client tests in `game/client/test/cardRenderers.test.js` are extended to
  assert: (a) `divine_grace` resolves to a different renderer fn than
  `healing_font`; (b) the helper-call signature/palette differs from
  `healing_font` and `purifying_pulse` for the same payload; (c) heal sound
  gating on `hpGained`/`myId`; (d) radius-absent skips all VFX; (e) a
  timing/sync assertion that `spawnDivineGraceEffect` is invoked within the same
  synchronous `renderDivineGrace` call (no deferred scheduling).

## Technical Specs

- `game/client/cardRenderers.js` — update `renderDivineGrace` (around L542) and
  its `DIVINE_GRACE_COLOR` / `DIVINE_GRACE_EMISSIVE` constants (L517–518) to the
  coherent holy-gold palette; keep calling `ctx.spawnDivineGraceEffect(origin,
  data.radius)` and `ctx.spawnParticleBurst(...)`; keep the `getAccentHex`
  fallback, the `hpGained`/`myId` sound gate, and the `data.radius === undefined`
  guard. Leave the `divine_grace: renderDivineGrace` registration line (~L1298)
  as-is.
- `game/client/test/cardRenderers.test.js` — extend the existing `divine_grace`
  tests (around L1021–L1132) to add the palette-distinctness vs `purifying_pulse`
  and the synchronous-invocation/timing assertions; keep using the existing
  `record(...)` ctx mock harness.
- Do NOT modify `spawnDivineGraceEffect` internals (owned by sub-ticket 01), the
  server, or any other card.

## Verification: code
