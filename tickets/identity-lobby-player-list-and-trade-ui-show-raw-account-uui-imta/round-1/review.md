# Senior Review — identity: lobby player list and trade UI show raw account UUIDs instead of player names

## Runtime health (gate)

- `metrics.json`: `"ok": true`, servers started, `url` reachable, `pageerrors: []`.
- `pageerrors.json`: empty `[]`.
- `console.log`: only benign Vite connect + initScene/launchBooth logs; no `pageerror`, no `[fatal]`, no uncaught exceptions.
- Capture used the deterministic fallback full-flow smoke (auth → lobby → ready → gameplay → dodge). The game loads and runs cleanly. The capture did not screenshot the lobby overlay / trade UI specifically, so the identity fix is verified by direct code reading + unit tests rather than by screenshot.

The game runs. Gate passes.

## Scope of change

`git diff de5bca4c..HEAD` touches only:
- `game/server/index.js` — `lobbyPlayerList()` now emits `username`; new `syncLivePlayerUsername()` exported.
- `game/server/account.js` — `PATCH /me/profile` calls `syncLivePlayerUsername` when the username changes.
- `game/client/main.js` — portrait char-id and lobby list render username.
- `game/client/vanguard-hud.js` — `formatCharacterId` param renamed to a display name (semantics unchanged).

Small, focused, consistent with existing patterns.

## Acceptance criteria

**AC: Lobby player list, trade target selector, and HUD identity render the username; save reflected without rejoin; no UUIDs in player-facing UI.**

- **Lobby player list** — `main.js:4048` renders `${p.username || p.id} — ...`. Server `lobbyPlayerList()` (`index.js:703`) now includes `username: p.username || id`, and server player records carry `username` via `buildPlayerRecord` (`index.js:1096`). PASS.
- **Trade target dropdown** — `renderTradeForm` (`main.js:2861-2865`) renders `player.username || player.id`, sourced either from the passed lobby player list (now carrying username) or from `gameState.players` (`...username: p.username || id`). The prior bug was that the source data lacked username; the server fix now propagates it. PASS.
- **Portrait character-id** — `updateVanguardPortrait` (`main.js:2129`) now passes `gameState.players[myId]?.username || myId` into `formatCharacterId`, so the 2-char badge derives from the username rather than the UUID. The local player's `username` is populated from presence sync (`main.js:867`). PASS.
- **Incoming trade-offer text** — `main.js:2840` uses `fromUsername`, which the server already supplies (`tradeHandlers.js:51`). PASS.
- **Save name reflected without rejoin** — `syncLivePlayerUsername` (`index.js:1203`) pushes the new username onto every live player record for the account across the legacy singleton `gameState` and all active lobby states, then re-broadcasts the affected lobbies (and legacy lobby). It is invoked from `account.js:125` only on `usernameChanged`. This mirrors the established `syncLivePlayerCosmetic` flow one-for-one (same lazy `require('./index')` to avoid the circular dep, same `lobbies._lobbies.values()` iteration, same broadcast helpers), so it is correct and robust. PASS.

No remaining raw-UUID render paths found: a grep of `textContent`/`option.value`/`.value =` against player identity fields in `main.js` surfaces only the four fixed spots plus `lobby.name || lobby.id` (a lobby name, not a player), which is expected.

## Design / regression check

Consistent with `syncLivePlayerCosmetic` and the lobby-broadcast architecture; no foundation regression. `formatCharacterId` rename is purely cosmetic — its unit tests (`vanguard-hud.test.js`) still pass.

## Validation run

- `client/test/vanguard-hud.test.js` — 19 passed (incl. `formatCharacterId`).
- `server/test/account.test.js` + `cosmetic_runtime.test.js` — 20 passed, including the `PATCH /me/profile` username-change path that now triggers `syncLivePlayerUsername` (no crash from the lazy require).

## Remaining gaps

None blocking. The acceptance criterion is fully and robustly met, the game runs cleanly, and the change is consistent with existing patterns.

VERDICT: PASS
