# Cryo Burst: lingering frost field synced to the 2.5s server freeze

After the cast burst (sub-ticket 01), Cryo Burst applies a freeze to enemies in
radius for `freezeDurationMs` (2500ms on the server). Give the renderer a
lingering frost-field visual at the cast origin whose on-screen lifetime is
timed to that freeze duration, so the animation's persistence reads as the
"things are frozen for ~2.5s" effect. Everything must still fire synchronously
with the instant `CARD_USED` resolution (no projectile/wind-up delay).

## Acceptance Criteria

- `renderFrostNova` spawns a lingering frost-field visual centered on the cast
  origin (e.g. a slow-fading frost impact decal / ground sheen sized to
  `data.radius`) whose `duration` is set to the Cryo Burst freeze window
  (2500ms), NOT the default short impact/hit-spark lifetime.
- The freeze duration value (2500ms) is a named client-side constant in
  `game/client/cardRenderers.js` with a comment noting it mirrors the server's
  `frost_nova` `freezeDurationMs` in `game/shared/cardStats.json` (the
  `CARD_USED` payload does not carry it). If `cardStats` `freezeDurationMs` is
  imported/available client-side, source it from there instead of hardcoding.
- The lingering visual fires only on the freeze path — i.e. when the payload
  indicates a freeze (`data.frozen === true` and/or `data.specialEffect ===
  'freeze'`); when present this gates the lingering field. The immediate cast
  burst (ring/shard burst from sub-ticket 01) still fires regardless.
- All spawns happen synchronously inside `renderFrostNova` — no `setTimeout`,
  no `scheduleAfter`, no Promise/async delay — matching the server emitting
  `CARD_USED` immediately in the `frost_nova` branch.
- The lingering field uses the ice palette (same accent/emissive as the cast
  burst) so it reads as the same frost effect.
- A client test asserts the lingering frost visual is spawned with a
  `duration` equal to the 2500ms freeze constant when the payload carries
  `frozen: true`, and that no async scheduling is used.
- Full client + server vitest suite passes; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`: in `renderFrostNova`, add a named constant
  (e.g. `const FROST_NOVA_FREEZE_MS = 2500;`) with a comment referencing the
  server `freezeDurationMs` in `game/shared/cardStats.json`. Spawn the
  lingering field via `ctx.spawnImpactDecal(origin, { color, emissive, radius:
  data.radius, duration: FROST_NOVA_FREEZE_MS })` (the decal primitive already
  honors a `style.duration`, default `HIT_SPARK_DURATION`; see
  `spawnImpactDecal` in `game/client/renderer.js` ~line 6026). Gate it behind
  the freeze flag from the payload (`data.frozen` / `data.specialEffect ===
  'freeze'`), which `cardEffects.js` sets (`frozen: true`,
  `specialEffect: cardDef.specialEffect`).
- The `CARD_USED` payload for `frost_nova` (`game/server/cardEffects.js` ~742)
  carries `{ origin, radius, hits, frozen: true, specialEffect }` — read from
  these; do NOT modify the server or add payload fields (client-only scope).
- `game/client/test/cardRenderers.test.js`: add a test that calls the
  `frost_nova` renderer with `{ frozen: true, radius, origin, hits: [] }` and
  asserts a lingering `spawnImpactDecal` call carries `duration === 2500`.
- Build on sub-ticket 01's renderer; do not regress its cast-burst behavior or
  its tests. Do NOT touch the server, other card renderers, or shared stats.

## Verification: code
