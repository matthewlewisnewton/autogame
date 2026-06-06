# Hub walkability, party presence, and per-room screenshots

Extend the hub playthrough driver with a two-player slice: both browsers auth, the joiner enters the host's lobby, the squad reaches the ship hub (`layout.profile === 'hub'`), and both players walk through the three hub zones while party-mate presence is observable. Capture the hub overview and one screenshot per room.

## Acceptance Criteria

- `--steps hub-walk` with `--preset hub` spins up two Playwright pages against the same isolated game process, registers two users, and joins them into one lobby/channel.
- After create/join, both pages wait for `__AUTOGAME_HARNESS_STATE__()` with `phase === 'lobby'`, `hasCanvas === true`, `layout.profile === 'hub'`, and `layout.roomCount === 3`.
- Party presence: on the host page, `players >= 2` in harness state (or equivalent probe showing a connected squadmate in `gameState.players`); after the joiner's first `hubPresenceUpdate`-driven move, the host's remote player entry has a different `(x, z)` than at join time.
- Walkability: each hub zone (`operations`, `commerce`, `salon`) is visited by driving WASD (or `move` socket emits) so the local player's `(x, z)` changes and remains inside the hub layout (`layout.profile === 'hub'` throughout).
- Screenshots under `game/validation/hub/`:
  - `01-hub-overview.png` — both players in hub lobby, canvas visible.
  - `02-room-operations.png`, `03-room-commerce.png`, `04-room-salon.png` — one per zone after walking into that room.
- Step exits `0` on success; failures print harness-state JSON for both pages.
- No combat deploy, boss scenarios, or dungeon `layout.profile !== 'hub'` in this slice.

## Technical Specs

- Edit: `harness/validate/playthrough.mjs` — implement `runHubWalkStep({ browser, game, preset, outDirAbs })` orchestrating two pages; wire `--steps hub-walk`.
- New (suggested): `harness/validate/lib/multiPlayer.mjs` — helpers to `registerUser`, `injectToken`, `createLobby`, `joinLobby`, and `waitForHubLobby(page)` reused by later slices.
- New (suggested): `harness/validate/lib/hubMovement.mjs` — `walkToZone(page, zoneName, boothAnchors)` using keyboard nudges (mirror `combat.mjs` `nudgeToward`) toward each room center derived from `harness.layout` / known `generateHub` coordinates.
- Reuse: `readHarness`, `writeScreenshot`, `startGame`/`stopGame` from existing validate libs.
- Hub zone names and booth anchor keys: `game/server/dungeon.js` `generateHub()`; tests in `game/server/test/hub_client_payload.test.js`.
- Optional minimal `game/client/main.js` harness hook: expose `hubPresenceEntryCount` only if `players` count is insufficient to detect a remote squadmate (document in findings if added).

## Verification: code
