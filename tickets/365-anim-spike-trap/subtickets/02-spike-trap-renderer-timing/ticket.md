# Spike Trap — dedicated renderer, timing sync & tests

Give `spike_trap` its own card renderer (`renderSpikeTrap`) that drives the
erupting-spikes primitive, split it off from the shared `renderGroundEnchantment`
(leaving `cinder_snare` on the generic ground renderer), confirm its timing is
synced to the server's enchantment resolution, and lock the behavior down with
client tests. Depends on sub-ticket 01 (`spawnSpikeTrapEffect`).

## Acceptance Criteria

- A new `renderSpikeTrap(data, ctx)` exists in `game/client/cardRenderers.js`,
  and the `spike_trap` entry in `CARD_RENDERERS` (currently `renderGroundEnchantment`,
  ~L1373) maps to `renderSpikeTrap`. `resolveRenderers('spike_trap')` still
  returns exactly one renderer.
- `cinder_snare` STAYS mapped to the shared `renderGroundEnchantment` (~L1375),
  so the two ground enchantments are now visually distinct: `spike_trap`
  resolves to a DIFFERENT renderer fn than `cinder_snare`.
- `renderSpikeTrap` calls the new spike primitive (`ctx.spawnSpikeTrapEffect`)
  at the placement origin with the card's radius, plus a hostile-red telegraph
  ring at `data.radius` (the armed proximity-hazard zone). It uses the
  steel/blood-red spike palette, NOT the orange fire palette used for
  `cinder_snare`.
- The existing radius guard is preserved: when `data.radius` is undefined, no
  VFX calls fire (matching the current `renderGroundEnchantment` early return).
- Timing is synced to the server and fires synchronously at cast: the placement
  animation plays in the same synchronous `renderSpikeTrap` call when the
  `spike_trap` CARD_USED event is handled — NO artificial `setTimeout`/projectile
  delay. (Server resolves `spike_trap` by emitting CARD_USED only after the
  500ms `windUpMs` commit, during which the 307/315 charge telegraph already
  plays; the trap then arms for `ttlMs` 30000 and deals its single
  `proximity_hazard` burst server-side — the client renderer is placement-only.)
- The renderer guards on `ctx.spawnSpikeTrapEffect` existing before calling it
  (graceful no-op if the primitive is absent), and adds no new network traffic
  or server payload changes.
- No perf regression and the full client + server vitest suite passes.
- Client tests in `game/client/test/cardRenderers.test.js` are updated/extended
  to assert: (a) `spike_trap` resolves to a different renderer fn than
  `cinder_snare`; (b) `renderSpikeTrap` invokes `spawnSpikeTrapEffect` (and the
  telegraph ring) at the placement origin/radius with the steel/red palette for a
  normal payload; (c) `data.radius === undefined` skips all VFX; (d) a
  timing/sync assertion that the spike primitive is invoked within the same
  synchronous `renderSpikeTrap`/`renderCardUsed` call (no deferred scheduling).
  The existing `spike_trap renders a red ground-trap AoE preview` test
  (~L2103) must be updated to the new spike-renderer behavior.

## Technical Specs

- `game/client/cardRenderers.js` — add `renderSpikeTrap(data, ctx)` near
  `renderGroundEnchantment` (~L1174). Keep the `data.radius === undefined` early
  return; call `ctx.spawnSpikeTrapEffect(originOf(data), data.radius)` (guarded by
  `if (ctx.spawnSpikeTrapEffect)`) and `ctx.spawnTelegraphRing(originOf(data),
  data.radius, { color, emissive })` with a steel/blood-red palette (reuse the
  card accent `getAccentHex('spike_trap')` ≈ `0xf87171` for `color`, red
  `emissive`). Define named palette constants alongside the other renderer
  palette blocks. Change the registry line `spike_trap: renderGroundEnchantment`
  (~L1373) to `spike_trap: renderSpikeTrap`; LEAVE
  `cinder_snare: renderGroundEnchantment` (~L1375) unchanged.
- `game/client/test/cardRenderers.test.js` — update the existing `spike_trap`
  enchantment-dispatch test (~L2103) and the resolver test (~L59) for the new
  renderer, and add the palette/distinctness-vs-`cinder_snare` and
  synchronous-invocation/timing assertions, using the existing ctx mock harness.
- Do NOT modify `spawnSpikeTrapEffect` internals (owned by sub-ticket 01), the
  server, `renderGroundEnchantment` itself, or any other card.

## Verification: code
