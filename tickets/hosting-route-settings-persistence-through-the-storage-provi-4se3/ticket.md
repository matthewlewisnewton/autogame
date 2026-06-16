# Hosting: route settings persistence through the storage provider (Postgres parity)

## Difficulty: medium

## Goal

settings.js persists per-account settings as JSON files (settingsFilePath), separate from the StorageProvider — for multi-instance hosting these must live in shared storage too. Route settings load/save through the provider abstraction so they persist in Postgres when PERSISTENCE_BACKEND=postgres, keeping file/in-memory behavior for default/test. Preserve the existing accountId sanitization.

## Acceptance Criteria

- Settings read/write go through the provider; with PERSISTENCE_BACKEND=postgres they persist to Postgres (verified via pg-mem); file/in-memory modes unchanged; existing settings tests pass.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
