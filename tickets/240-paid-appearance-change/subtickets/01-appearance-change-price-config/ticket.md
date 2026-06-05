# 01 — Appearance change price config

Add a shared, authoritative gold price for character-booth appearance edits
(body colors, body shape, model, proportions). Mirror the `MEDIC_HEAL_COST` pattern:
one value in `shared/constants.json`, re-exported on server and client, and included
in the authenticated profile payload so the booth UI can display the cost without
hardcoding.

## Acceptance Criteria

- `shared/constants.json` defines `APPEARANCE_CHANGE_COST` as a positive integer
  (pick a sensible value, e.g. `25`).
- `game/server/config.js` imports and exports `APPEARANCE_CHANGE_COST`.
- `game/client/config.js` imports and exports `APPEARANCE_CHANGE_COST`.
- `GET /api/me` includes `appearanceChangeCost` matching the shared constant.
- Existing vitest suites pass; add or extend a small test in
  `game/server/test/account.test.js` (or `config` coverage) asserting the field is
  present and equals the shared value.

## Technical Specs

- **`game/shared/constants.json`** — add `"APPEARANCE_CHANGE_COST": <n>`.
- **`game/server/config.js`** — destructure from `../shared/constants.json` and
  export `APPEARANCE_CHANGE_COST` alongside `MEDIC_HEAL_COST`.
- **`game/client/config.js`** — import and export `APPEARANCE_CHANGE_COST`.
- **`game/server/account.js`** — in `GET /api/me`, include
  `appearanceChangeCost: APPEARANCE_CHANGE_COST` (import from `./config`).
- **`game/server/test/account.test.js`** — assert `appearanceChangeCost` on the
  `/api/me` response.

No charge logic, socket handlers, or client booth UI changes in this sub-ticket.

## Verification: code
