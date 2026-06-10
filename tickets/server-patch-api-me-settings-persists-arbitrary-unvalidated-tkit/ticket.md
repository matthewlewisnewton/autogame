# Server: PATCH /api/me/settings persists arbitrary unvalidated JSON with unbounded growth

## Difficulty: medium

## Goal

updateSettings (game/server/settings.js:32-44, 93-103, called from game/server/account.js:64-71) deep-merges whatever object the client sends (only is-a-non-array-object is checked) and writes it to data/settings/{accountId}.json. No key whitelist, no value-type validation, no size cap — any authenticated user can persist arbitrary nested keys, and repeated PATCHes with new keys grow the file without bound (express.json 100KB limit caps a single request, not the accumulated merge). The junk is served back verbatim via GET /api/me. Fix: validate against a settings schema the way validateCosmetic (game/server/cosmetic.js) whitelists fields — known keys, known types, prune everything else — and cap stored size. Found in code review 2026-06-09.

## Acceptance Criteria

- Settings PATCH only persists whitelisted keys with validated types; unknown keys are pruned; stored settings size is capped; tests cover rejection/pruning

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
