# Corebreaker Greatsword: sync VFX reach to the server-resolved attackRange

The Corebreaker Greatsword renderer hardcodes its cone/impact/trail reach to
`7`, but `magma_greatsword` has no `attackRange` in shared stats, so the server
resolves the weapon hit cone and the `fire_trail` area effect at the default
range (`5`). The visual hit/trail extends ~2 units beyond the real gameplay
effect. Close the gap by giving the card its intended `attackRange: 7` in shared
stats AND making the renderer derive its reach from the server-emitted payload so
client VFX and server resolution always agree.

## Acceptance Criteria

- `magma_greatsword` in `game/shared/cardStats.json` has an explicit
  `attackRange: 7` so the server-side weapon hit cone and the `fire_trail` area
  effect (`spawnFireTrailEffect`, which uses `cardDef.attackRange || ATTACK_RANGE`)
  resolve at `7` instead of the default `5`.
- `renderCorebreakerGreatsword` derives its reach from the server-emitted payload:
  `const range = data.attackRange ?? style.range;` (i.e. it no longer reads
  `style.range` directly for the cone/impact/trail/pulses). When the payload
  carries `attackRange`, the on-screen cone range, `impactAt`, the
  `spawnDragonsBreathEffect` `range`, and the per-tick `pulseAt` all use that
  derived `range`. `style.range` (7) remains only as the fallback default.
- With the new `attackRange: 7` stat, the derived client `range` and the server
  `fire_trail`/hit range are equal (both `7`) — the visuals no longer overstate
  the real reach.
- No new `CARD_USED` payload fields are invented; the renderer reads the existing
  `data.attackRange` already carried for weapon cards (same pattern as
  `renderStyledBlade` at ~line 527, which uses `data.attackRange || style.range`).
- All other behavior from sub-ticket 01 is preserved unchanged: dedicated
  renderer registration, derived `dotTicks`/`dotIntervalMs` cadence, heavy magma
  swing, large impact decal/burst, lingering fire-zone, `swingCount`/photon
  stagger handling, and graceful degradation when optional primitives are absent.
- `steel_claymore` behavior is unchanged (it has no `attackRange` change and keeps
  `renderHeavyGreatsword`).
- `game/client/test/cardRenderers.test.js` is updated so the Corebreaker
  assertions assert the SYNC CONTRACT: when fired with a payload carrying
  `attackRange`, the rendered cone/impact/trail range equals the payload's
  `attackRange` (not the hardcoded `7`); and when fired without `attackRange`, it
  falls back to the style default. Existing magma swing/decal/debris/DoT-cadence
  assertions still pass.
- The full client vitest suite passes, and server tests still pass with the new
  `attackRange: 7` stat (no test asserts magma_greatsword resolves at range 5).

## Technical Specs

- `game/shared/cardStats.json`:
  - In the `magma_greatsword` entry (currently `damage`, `dotTicks`,
    `dotIntervalMs`, `trailDamagePerTick`, `windUpMs`, `isEvolved`,
    `specialEffect: "fire_trail"`), add `"attackRange": 7`.
- `game/client/cardRenderers.js`:
  - In `renderCorebreakerGreatsword` (~line 633): compute
    `const range = data.attackRange ?? style.range;` after resolving `style`, and
    use `range` (instead of `style.range`) for: the `swing()` cone
    `range`, the `impactAt = pointAlong(origin, direction, range)`, the
    `spawnDragonsBreathEffect` `range`, and the per-tick
    `pulseAt = pointAlong(origin, direction, range * 0.6)`. Decal radius / debris
    counts that are not range-derived stay on `style.*`.
- `game/client/test/cardRenderers.test.js`:
  - Update the Corebreaker range expectations (the magma swing / impact / trail
    assertions, ~lines 1556+) to derive the expected range from the payload's
    `attackRange` when present, and add an assertion that firing with a payload
    `attackRange` (e.g. a value ≠ 7) makes the cone/impact/trail use that value,
    while omitting it falls back to the style default. Do not weaken
    `steel_claymore` coverage.

## Verification: code
