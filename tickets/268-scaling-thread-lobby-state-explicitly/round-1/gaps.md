1. The test/coverage run is not green: `server/test/account.test.js > GET /api/me > returns profile and default settings` gets HTTP 500 from `/api/register` instead of the expected 201.
   Files: `game/server/test/account.test.js`, `game/server/auth.js`, `game/server/users.js`
   Fix: Diagnose the registration failure in the account test run and make `cd game && pnpm test:quick` pass; likely inspect user-file/test isolation around `setTestFilePath`, `createUserAsync`, and `saveUsers`.
