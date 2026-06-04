1. `unlockHat` proceeds to persist the account hat unlock even if the preceding currency save failed, because `savePlayerData()` catches provider errors and returns no success/failure signal.
   Files: `game/server/index.js`, `game/server/progression.js`, `game/server/test/hat_unlock_persistence.test.js`
   Fix: make the currency persistence step observable for this purchase path (throw/return failure), abort or refund without calling `unlockHatForAccount()` when it fails, and add a regression test where the progress provider write throws while `users.json` remains writable.
