# Astral Guardian — astral shield ward on the caster

Visualize the card's namesake protective shield. The server grants the caster
an `astral_shield` on cast (`shieldGranted` in the `CARD_USED` payload) but the
renderer currently ignores it, so the "Guardian" half of the card is invisible.
Add an astral-tinted ward shell over the caster, gated strictly on
`shieldGranted`, so the shield-up moment reads on screen and matches the server
effect.

## Acceptance Criteria

- When `data.shieldGranted` is a positive number, `renderAstralGuardian` spawns
  a protective ward shell via `ctx.spawnMirrorWardShellEffect` at the cast
  `origin` (the caster position), tinted with the astral indigo/violet palette
  (`ASTRAL_GUARDIAN_COLOR` / `ASTRAL_GUARDIAN_EMISSIVE`), NOT the default mirror
  silver/cyan.
- The ward shell is anchored to the caster via `style.playerId = data.playerId`
  (when present) so a re-cast replaces the prior shell rather than stacking.
- The ward shell uses a named visual-duration constant (e.g.
  `ASTRAL_SHIELD_SHELL_MS`) passed as `style.duration`, representing the
  shield-up flourish.
- The ward shell is **not** spawned when `data.shieldGranted` is absent, zero,
  or non-finite (no shield ⇒ no ward visual).
- The shield ward is additive: the guardian summon, telegraph ring, and impact
  burst from sub-ticket 01 still fire unchanged, and the renderer still no-ops
  when `data.radius === undefined`.
- The renderer does not throw when `ctx.spawnMirrorWardShellEffect` is absent.
- A client test in `game/client/test/cardRenderers.test.js` asserts: (a) with
  `shieldGranted` set, `spawnMirrorWardShellEffect` is called at origin with the
  astral palette and the `playerId` anchor; (b) with `shieldGranted` omitted,
  `spawnMirrorWardShellEffect` is NOT called.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`: extend `renderAstralGuardian(data, ctx)` to
  call `ctx.spawnMirrorWardShellEffect(origin, radius, { color, emissive,
  duration, playerId })` after the summon/impact visuals, guarded by
  `Number.isFinite(data.shieldGranted) && data.shieldGranted > 0` and a
  `ctx.spawnMirrorWardShellEffect &&` presence check. Pick a ward radius around
  the caster (~`1.5`) — independent of the wider `data.radius` AoE telegraph.
  Add an `ASTRAL_SHIELD_SHELL_MS` constant near the existing
  `ASTRAL_GUARDIAN_*` constants.
- `ctx.spawnMirrorWardShellEffect` signature: `(origin, radius, { color,
  emissive, duration, playerId })` — see `game/client/renderer.js:6141`;
  passing `playerId` dismisses any prior shell for that player before spawning.
- Payload fields are emitted server-side in `applyAstralShieldCast`
  (`game/server/cardEffects.js:250`): `shieldGranted`, `playerId`, `origin`,
  `radius`. Do not change the server.
- `game/client/test/cardRenderers.test.js`: extend the `astral_guardian`
  test(s) to cover the shield-present and shield-absent cases.
- Do not touch the server, the player shield bar UI, or any other card's
  renderer.

## Verification: code
