1. Full validation is not green: `coverage.log` reports 3 failed tests, including the new cosmetic runtime profile-sync test returning 500 during registration with `ENOENT` renaming `game/data/users.json.tmp`.
   Files: `game/server/users.js`, `game/server/test/cosmetic_runtime.test.js`, `game/server/test/account.test.js`, `game/server/test/field_medic_kit.test.js`
   Fix: make user persistence/test setup race-safe under parallel Vitest (isolated user file paths or unique atomic temp files) and fix/control the medic-kit MS precision assertion so the full suite passes.
