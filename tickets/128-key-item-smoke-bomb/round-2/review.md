# Senior Review — Key Item: Smoke Bomb (128)

## Runtime health (gate)

- `round-2/metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure`
  block, servers started, two clients reached `phase: "playing"` with a live
  scene (`sceneInitialized: true`, `hasCanvas: true`).
- `round-2/console.log`: only Vite connect + `[initScene]` logs. No
  `pageerror` / `[fatal]` lines from game code.

The game starts and loads cleanly. Gate passes.

## Per-criterion findings

### Cooldown ~8s
PASS. `KEY_ITEM_DEFS.smoke_bomb.cooldownMs` retuned from the stale `18000` to
`8000` (`game/server/progression.js`). The cast handler sets
`player.keyItemCooldownUntil = now + (def.cooldownMs || 8000)`, and the generic
cooldown gate at `index.js:2745-2750` (which runs before the per-item branch)
rejects an early re-cast with `on_cooldown`. The unit test
`cooldown enforced: immediate re-cast returns on_cooldown and does not refresh
the smoke window` confirms the window is not refreshed by the rejected re-cast.

### Zone follows player or stays fixed (documented choice)
PASS. Choice = **fixed at the cast point**, clearly documented in three places:
the cast handler comment (`index.js`), the `isPlayerConcealed` header comment,
and the client animate-loop comment. The cast snapshots `smokeBombX/Z` to the
caster's position and concealment is computed against that fixed center, so a
player can walk out and become targetable again — covered by the
`isPlayerConcealed ... false once exited` test.

### Client smoke VFX
PASS. `triggerSmokeVFX` (`game/client/renderer.js`) spawns a translucent grey
puff cluster that rises, expands, and fades over ~2s, with proper geometry/
material disposal and per-player de-duplication. It is triggered both on the
caster's own `keyItemUsed` ack (`main.js`) and re-triggered in the animate loop
for any player whose `smokeBombUntil` is active (so allies/other clients see it),
with a 300ms tail guard so a near-expired zone doesn't spawn a fresh 2s puff.

### Tests: targeting cleared / miss rate while in zone
PASS. The chosen rule is **enemies cannot acquire a concealed player, and an
in-flight wind-up against a newly-concealed player is cancelled** (clean,
documented rule). `game/server/test/smoke_bomb.test.js` (9 tests, all passing —
verified via `npx vitest run server/test/smoke_bomb.test.js`) covers:
def tuning, socket cast/cooldown, `isPlayerConcealed` in/out/expired, ally
concealment inside the caster's zone, no target acquisition while concealed,
re-acquisition after expiry, wind-up cancellation on concealment, and the
negative control (non-concealed player still takes the hit).

## Design / regression consistency

- Concealment is implemented in `simulation.js` (`isPlayerConcealed`) and wired
  into both target acquisition and wind-up resolution in `updateEnemies`. The
  wind-up path correctly excludes minion targets (`windupTargetType !== 'minion'`)
  so smoke only protects players, not minions — consistent and intentional.
- Follows the established key-item pattern (generic phase/cooldown gates, then a
  per-item branch, transient state on the player, snapshot fields in
  `stateSnapshot`). No regression to existing key items.

## Debug scenario (`smoke-bomb-ready`)

Verified all three requirements:
- **Gated**: only reachable via the `debugScenario` socket event behind
  `isDebugScenarioAllowed` (`index.js:3514-3522`) and membership in
  `DEBUG_SCENARIOS`. Normal gameplay never invokes it.
- **End-state still reachable normally**: the scenario only equips `smoke_bomb`,
  zeroes the cooldown, and spawns two enemies in range. The identical state is
  reachable by equipping the Smoke Bomb key item and approaching enemies; the
  comment documents this.
- **No invariant bypass**: the scenario does not cast the bomb or fabricate the
  smoke zone — the player still casts through the real `useKeyItem` path, which
  applies the cooldown, persistence flag, and concealment exactly as in normal
  play.

## Remaining gaps

None blocking. The ticket is fully and robustly satisfied. (Minor non-blocking
nits recorded in `nits.md`.)

VERDICT: PASS
