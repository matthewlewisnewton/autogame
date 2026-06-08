# Mirror Ward — dismiss lingering shell on reflect consumption

When Mirror Ward reflects damage the server clears `player.activeEnchantment`
immediately, but the client cast shell still runs for the full `ttlMs` (20 s).
Track each active ward shell by caster `playerId` and dispose it when the
`reflectTriggered` `CARD_USED` event arrives so the visual lifetime matches
server-side consumption.

## Acceptance Criteria

- `spawnMirrorWardShellEffect` records the owning `playerId` on the
  `activeEffects` entry (via `style.playerId`) and in a lookup map so at most
  one active shell exists per player at a time; spawning a new shell for the
  same `playerId` dismisses any prior shell first.
- New exported `dismissMirrorWardShellEffect(playerId)` in `renderer.js`
  disposes the tracked shell mesh (via `disposeEffectObject`) and removes it
  from `activeEffects` immediately — no waiting for natural TTL expiry.
- `renderMirrorWard` cast path passes `data.playerId` into
  `spawnMirrorWardShellEffect`; reflect path (`data.reflectTriggered === true`)
  calls `dismissMirrorWardShellEffect(data.playerId)` **before**
  `spawnMirrorWardReflectBurst`, then returns without spawning a new shell.
- After a reflect event, `getActiveEffects()` contains no `isMirrorWardShell`
  entry for that `playerId`; the reflect burst still spawns normally.
- Natural TTL expiry (ward times out without reflecting) still cleans up via
  `updateAttackEffects()` — unchanged behavior.
- `main.js` `cardRenderCtx` exposes `dismissMirrorWardShellEffect`.
- `game/client/test/vfx-primitives.test.js` covers dismiss: spawn shell with
  `playerId`, call dismiss, assert shell removed from `activeEffects` and mesh
  disposed.
- `game/client/test/cardRenderers.test.js` reflect-path test asserts
  `dismissMirrorWardShellEffect` is called once with the payload `playerId`
  before `spawnMirrorWardReflectBurst`.
- `cd game && pnpm test:quick` passes; no server changes required (reflect
  `CARD_USED` already includes `playerId`).

## Technical Specs

- **`game/client/renderer.js`**:
  - Add module-level `const mirrorWardShellsByPlayer = new Map()` keyed by
    `playerId` → `activeEffects` index or direct effect reference.
  - Extend `spawnMirrorWardShellEffect(origin, radius, style = {})`:
    - If `style.playerId` is set, call `dismissMirrorWardShellEffect(style.playerId)`
      before creating a new shell.
    - Store `playerId: style.playerId` on the pushed `activeEffects` entry.
    - Register the effect in `mirrorWardShellsByPlayer` when `playerId` is set.
  - Add `export function dismissMirrorWardShellEffect(playerId)`:
    - Look up the tracked shell; if missing, no-op.
    - `disposeEffectObject(fx.mesh, fx._scene || scene)` and splice from
      `activeEffects` (reconcile map indices after splice, or store effect ref
      directly and scan/splice by identity).
    - Delete the map entry.
  - In `updateAttackEffects()` mirror-shell cleanup branch (~L5260), also delete
    the `mirrorWardShellsByPlayer` entry when a shell expires naturally.
- **`game/client/cardRenderers.js`**:
  - Cast branch: pass `{ …, playerId: data.playerId }` to
    `spawnMirrorWardShellEffect`.
  - Reflect branch: call `ctx.dismissMirrorWardShellEffect?.(data.playerId)`
    before `spawnMirrorWardReflectBurst`.
- **`game/client/main.js`**: import and wire `dismissMirrorWardShellEffect` on
  `cardRenderCtx`.
- **`game/client/test/vfx-primitives.test.js`**: import `dismissMirrorWardShellEffect`;
  add test for early dismiss by `playerId`.
- **`game/client/test/cardRenderers.test.js`**: extend `makeCtx` mock with
  `dismissMirrorWardShellEffect: record(...)`; update reflect-path test to assert
  dismiss called with correct `playerId` and ordering before burst.
- **Read-only reference**: server reflect payload shape in
  `simulation.js` `damagePlayer` (`playerId`, `reflectTriggered: true`) and
  cast payload in `cardEffects.js` — both already carry `playerId`; do not
  modify server files unless tests prove `playerId` is missing (it is not).

## Verification: code
