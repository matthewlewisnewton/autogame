# 11 — Smoke bomb persistenceDirty cast contract

The recorded vitest coverage run fails `game/server/test/smoke_bomb.test.js > casting sets smokeBombUntil/radius/center and cooldown on the caster` because `persistenceDirtyOnCast` is `false` when the `keyItemUsed` handler runs, even though smoke-bomb cast should mark the player dirty for persistence (matching `barrier_dome` and other key items). Restore the dirty/save contract so the suite passes.

## Acceptance Criteria

- Casting `smoke_bomb` sets `player.persistenceDirty = true` before emitting `keyItemUsed` to the caster.
- When the test captures `player.persistenceDirty` synchronously inside the `keyItemUsed` socket handler, the value is `true` (`persistenceDirtyOnCast === true`).
- No regression to smoke-bomb cast fields: `smokeBombUntil`, `smokeBombRadius`, `smokeBombX`, `smokeBombY`, `smokeBombZ`, and cooldown still set correctly.
- `game/server/test/smoke_bomb.test.js` passes in full, including the persistence assertion.
- `pnpm test` (or the project's vitest coverage command) completes without the smoke-bomb persistence failure.

## Technical Specs

- `game/server/keyItemEffects.js` — in the `smoke_bomb` branch (~line 167): confirm `player.persistenceDirty = true` is set after all smoke fields and **before** `socket.emit(SERVER_TO_CLIENT.KEY_ITEM_USED, ...)`. If a synchronous path (e.g. `io.to(...).emit(STATE_UPDATE, ...)` triggering `flushDirtyPlayerSaves` via game-loop tick) clears the flag before the caster receives `keyItemUsed`, reorder or defer the flush so the dirty flag survives until after the cast emit (mirror the working `barrier_dome` cast ordering).
- `game/server/simulation.js` — only touch `flushDirtyPlayerSaves` / tick flush if needed to prevent clearing dirty between cast field writes and `keyItemUsed` emit; prefer the minimal ordering fix in `keyItemEffects.js`.
- `game/server/test/smoke_bomb.test.js` — keep the existing `persistenceDirtyOnCast` assertion unless product intent is that smoke-bomb is intentionally non-persistent; if so, document and change the test to match actual save behavior instead of expecting dirty. Default fix: make dirty `true` on cast.

## Verification: code
