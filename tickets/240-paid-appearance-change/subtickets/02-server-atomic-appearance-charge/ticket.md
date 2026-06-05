# 02 — Server atomic appearance charge

Implement a lobby-scoped socket path for character-booth saves that charges gold
when **appearance** fields change (`bodyColor`, `accentColor`, `bodyShape`, `modelId`,
`proportions`) and stays free for **hat-only** swaps (ticket 241 scope). Reuse the
215 currency-then-commit ordering: persist deducted currency via `savePlayerData`
before writing cosmetic to `users.json` through `updateProfile`; refund and re-save
if the account write fails.

Depends on sub-ticket **01** for `APPEARANCE_CHANGE_COST`.

## Acceptance Criteria

- New socket event (e.g. `applyAppearance`) handled only in hub lobby phase
  (`withLobbyPlayer`, `requirePhase: 'lobby'`).
- Incoming `cosmetic` payload is validated with existing `validateCosmetic` /
  `updateProfile` rules; invalid input emits an error event (e.g.
  `appearanceError`) without mutating currency or account cosmetic.
- **Appearance delta detection:** compare requested appearance fields against the
  account's current cosmetic (after `backfillCosmetic`). If none of
  `bodyColor`, `accentColor`, `bodyShape`, `modelId`, or `proportions` differ,
  the save is free (no currency deduction) even when `hat` changes.
- **Paid path:** when at least one appearance field differs, deduct
  `APPEARANCE_CHANGE_COST` from `player.currency`; reject with
  `insufficient_gold` (or equivalent reason) when balance is too low.
- **Safe ordering on paid path:** after a successful in-memory deduction,
  `savePlayerData(socket.playerId)` runs **before** `updateProfile`; if
  `savePlayerData` fails, refund in memory and emit error without calling
  `updateProfile`.
- **Refund on account failure:** if `updateProfile` returns `ok: false` after
  currency was persisted, refund `player.currency` in memory and call
  `savePlayerData` again so disk matches RAM.
- **Success:** on completion, call `syncLivePlayerCosmetic`, emit a success event
  (e.g. `appearanceApplied`) with `{ cosmetic, currency, cost }` where `cost` is
  `0` for hat-only saves and `APPEARANCE_CHANGE_COST` for paid appearance edits.
- `PATCH /api/me/profile` remains unchanged (free) — paid charging is booth-only
  via the new socket path.
- Handler comments document the currency-first ordering and refund path (same
  rationale as `unlockHat` in `lobbyHandlers.js`).

## Technical Specs

- **`game/server/cosmetic.js`** — add `APPEARANCE_KEYS` (or equivalent) and
  `appearanceFieldsChanged(current, next)` helper comparing only appearance
  fields (exclude `hat`).
- **`game/server/progression.js`** — add `chargeAppearanceChange(player, cost)`
  mirroring `unlockHatForPlayer`: validate affordability, subtract cost, return
  `{ ok, cost, currency }` or `{ ok: false, reason }`.
- **`game/server/socketHandlers/lobbyHandlers.js`** — register `applyAppearance`
  handler following the `unlockHat` pattern (~L167–220): early validation,
  appearance-delta check, optional charge, `savePlayerData` → `updateProfile` →
  success emit / refund branches.
- **`game/server/index.js`** — wire any new progression exports into the lobby
  handler context if required by the scaffold pattern used for `unlockHatForPlayer`.
- Import `APPEARANCE_CHANGE_COST` from `../config`.

Do not add client confirm UI or persistence regression tests here (sub-tickets 03–04).

## Verification: code
