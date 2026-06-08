# Mirror Ward — reflect trigger sync and test coverage

Wire the one-shot reflect trigger to client VFX so the mirror burst plays when
the server actually reflects damage (not at cast time), and lock the full Mirror
Ward animation contract down with client + server tests. Depends on sub-tickets
01–02.

## Acceptance Criteria

- When `triggerMirrorWard` in `simulation.js` returns a non-null result with
  hits, the server queues a reflect event and the game loop drains it as a
  `CARD_USED` broadcast (same pattern as `_pendingMinionBreaths`):
  `{ cardId: 'mirror_ward', playerId, origin: { x, z }, reflectTriggered: true,
  direction, hits, reflectDamage }`.
- `renderMirrorWard` handles `data.reflectTriggered === true`:
  - Calls `ctx.spawnMirrorWardReflectBurst(origin, direction, …)` synchronously
    on the `CARD_USED` handler (no travel delay beyond the primitive's own
    600 ms streak window — reflect is instant server-side).
  - Does **not** spawn a new 20 s linger shell on reflect (ward is consumed).
  - `applyHitFlashes` in `renderCardUsed` still flashes reflected `hits`.
- Cast path from sub-ticket 02 remains unchanged and distinct from reflect path.
- `game/client/test/cardRenderers.test.js`:
  - Replaces the old `mirror_ward` teal `spawnSummonEffect` tests with cast-path
    assertions: `spawnMirrorWardShellEffect` at radius **11** with
    `duration: 20000`, plus telegraph ring + particle burst; non-self target
    no-ops.
  - Adds reflect-path test: payload with `reflectTriggered: true`, `direction`,
    and `hits` invokes `spawnMirrorWardReflectBurst` exactly once.
  - Asserts `resolveRenderers('mirror_ward')[0]` is `renderMirrorWard` and
    differs from `renderGroundEnchantment`.
  - Asserts `getCardDef('mirror_ward').windUpMs` is absent/zero.
- `game/server/test/enchantment.test.js` (or a small colocated test) asserts a
  live `damagePlayer` reflect path enqueues/drains the pending reflect
  `CARD_USED` with `reflectTriggered: true` and expected `hits`.
- `cd game && pnpm test:quick` passes with no perf-regression failures in
  touched suites.

## Technical Specs

- **`game/server/simulation.js`**:
  - In `damagePlayer`, when `mirrorResult` is truthy, push to
    `_gameState._pendingMirrorReflects` (initialize array if needed):
    `{ cardId: 'mirror_ward', playerId, origin: { x: player.x, z: player.z },
    reflectTriggered: true, direction: mirrorResult.direction,
    hits: mirrorResult.hits, reflectDamage: mirrorResult.reflectDamage }`.
- **`game/server/index.js`**: in the playing-phase tick (near the
  `_pendingMinionBreaths` drain ~L1402), drain `_pendingMirrorReflects` via
  `io.to(lobby.id).emit(SERVER_TO_CLIENT.CARD_USED, event)` then clear the queue.
- **`game/client/cardRenderers.js`**: extend `renderMirrorWard` with a
  `if (data.reflectTriggered)` branch at the top that calls
  `ctx.spawnMirrorWardReflectBurst(originOf(data), directionOf(data), …)` and
  returns before the cast branch.
- **`game/client/test/cardRenderers.test.js`**: update `describe('renderCardUsed()
  — enchantment dispatch')` mirror_ward cases; use the existing recording `ctx`
  mock pattern (`makeCtx` / `_calls`).
- **`game/server/test/enchantment.test.js`**: extend the existing
  `mirror_ward reflects damage` test (or add a sibling) to assert the pending
  queue / emitted payload shape when wired through the game loop helper used by
  other pending-VFX tests.
- Do **not** modify `spawnMirrorWardShellEffect` / `spawnMirrorWardReflectBurst`
  internals unless tests reveal a clear bug from sub-tickets 01–02.

## Verification: code
