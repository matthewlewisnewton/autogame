# 02 — Server applyAppearanceChange socket with atomic charge

Add a lobby-phase Socket.IO handler that applies character-booth appearance edits
for a gold cost, using the ticket-215 safe ordering: persist deducted currency to
the player progress file before writing the cosmetic to `users.json`. Hat-only
saves remain free.

## Acceptance Criteria

- A lobby-phase handler `applyAppearanceChange` accepts `{ cosmetic }` (same
  shape as the booth save payload: body colors, shape, hat, proportions).
- When `hasAppearanceFieldChanges(account.cosmetic, proposed)` is `false`
  (hat-only or no-op): apply via `updateProfile` with **no** currency deduction.
- When appearance fields change: validate affordability (`player.currency >=
  APPEARANCE_CHANGE_COST`), deduct cost in memory, call `savePlayerData` **before**
  `updateProfile`, then sync live cosmetic. On `updateProfile` failure or
  `savePlayerData` failure before commit: refund in memory and re-`savePlayerData`
  so disk matches RAM (mirror `unlockHat` refund paths in
  `lobbyHandlers.js`).
- On success emit `appearanceChanged` with `{ cosmetic, currency, cost }` (`cost`
  is `0` for hat-only/no-op, else `APPEARANCE_CHANGE_COST`). On failure emit
  `appearanceError` with `{ reason }` and make no partial exploit state (no free
  appearance on disk, no deducted currency without applied cosmetic).
- `PATCH /api/me/profile` rejects cosmetic updates that change appearance fields
  while the account has a live in-lobby player (`gamePhase === 'lobby'`), returning
  HTTP 400 so clients cannot bypass the socket charge. Hat-only PATCH updates
  while in lobby still succeed.
- Early-validation failures (not in lobby, invalid cosmetic, insufficient gold,
  locked hat) emit `appearanceError` and perform no persistence writes.

## Technical Specs

- `game/server/progression.js`:
  - Add `chargeAppearanceChangeForPlayer(player)` modeled on `unlockHatForPlayer`:
    checks `APPEARANCE_CHANGE_COST` affordability, deducts, returns
    `{ ok: true, cost, currency } | { ok: false, reason }`. Export it.
- `game/server/socketHandlers/lobbyHandlers.js`:
  - Add `socket.on('applyAppearanceChange', …)` inside `withLobbyPlayer` with
    `requirePhase: 'lobby'`.
  - Import `hasAppearanceFieldChanges` from `../../shared/cosmeticAppearance.js`,
    `APPEARANCE_CHANGE_COST` from `../config`, `updateProfile` from `../users`,
    `chargeAppearanceChangeForPlayer` from `../progression`.
  - Paid path ordering comment (currency first, cosmetic second) matching
    `unlockHat` (~L194–213).
  - Call `syncLivePlayerCosmetic` (via existing `index.js` export) after a
    successful profile write; broadcast `stateUpdate` if other lobby members need
    the cosmetic refresh (same as PATCH profile path).
- `game/server/account.js` — in `PATCH /me/profile`, before `updateProfile` when
  `cosmetic` is present: if appearance fields would change and a live lobby
  player exists for `req.accountId`, return `400` with an error string (e.g.
  `"Appearance changes in lobby must use applyAppearanceChange"`). Use a small
  helper from `index.js` if needed to resolve live player + phase.
- `game/server/index.js` — export any tiny lookup helper for account.js; wire
  handler registration if not already covered by `lobbyHandlers` scaffold.
- `game/server/test/apply_appearance_change.test.js` — socket-level tests for
  success, insufficient gold, hat-only free path, and PATCH rejection while in
  lobby (no persistence crash test here — that is sub-ticket 04).

## Verification: code
