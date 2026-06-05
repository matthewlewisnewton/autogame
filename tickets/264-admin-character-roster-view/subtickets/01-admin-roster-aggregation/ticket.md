# Admin roster data aggregation

Add a server-side helper that gathers every account/character into a single
read-only roster array, combining the account records (username, cosmetic,
unlocked hats, quest-tier/level-2 unlocks) with each account's persisted
character data (currency, selected deck, owned cards). This is the data layer
the `/admin` view will render; it performs no HTTP work.

## Acceptance Criteria

- `users.js` exports a `getAllUsers()` function returning an array of all
  in-memory user records (one per account). It must NOT include `passwordHash`
  in the returned objects (return shallow copies with `passwordHash` stripped).
- A new module `game/server/adminRoster.js` exports `buildAdminRoster()` that
  returns an array with one entry per account. Each entry includes, at minimum:
  `accountId`, `username`, `cosmetic` (full cosmetic config),
  `equippedHat` (the `cosmetic.hat` value), `unlockedHats` (array),
  `unlockedQuestTiers` (the level-2 / quest-tier unlock map), `currency`
  (number), and `selectedDeck` (array) plus `ownedCards`.
- Currency / deck / owned-card fields are read from the persisted character
  record loaded via the storage provider keyed by `accountId`
  (`getProvider().loadPlayer(accountId)`). When no persisted record exists for
  an account, those fields default safely (`currency: 0`, `selectedDeck: []`,
  `ownedCards: []`/`{}`) instead of throwing.
- `buildAdminRoster()` never mutates the user records or persisted data, and
  never includes `passwordHash`.
- A vitest file `game/server/test/admin_roster.test.js` covers: empty store
  returns `[]`; a created account appears with username/cosmetic/unlockedHats;
  an account with persisted player data surfaces its currency and selectedDeck;
  an account with no persisted data still appears with safe defaults; and the
  output contains no `passwordHash` field.

## Technical Specs

- `game/server/users.js`: add and export `getAllUsers()` — iterate the
  `users` Map values and return shallow copies with `passwordHash` removed.
  Add it to `module.exports`.
- `game/server/adminRoster.js` (NEW): `require('./users')` for `getAllUsers`
  and `require('./progression')` for `getProvider`. Implement
  `buildAdminRoster()` to map each user record into a roster entry, loading the
  persisted character via `getProvider() && getProvider().loadPlayer(accountId)`
  inside a try/catch so a load failure degrades to defaults. Export
  `buildAdminRoster`.
- `game/server/test/admin_roster.test.js` (NEW): follow the existing
  `test/account.test.js` / `test/persistence.test.js` patterns —
  `setTestProvider(new InMemoryProvider())`, `setTestFilePath()` to a temp file,
  `clearUsers()`, then `createUser()` and `provider.savePlayer(accountId, {...})`
  to seed data. Import from `../adminRoster.js`, `../users.js`,
  `../progression.js`, `../providers.js`.

## Verification: code
