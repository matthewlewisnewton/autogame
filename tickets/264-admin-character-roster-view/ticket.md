# 264-admin-character-roster-view

## Difficulty: medium

## Goal

Standalone /admin view listing every account/character with all data (username, cosmetic config, currency, unlocked+equipped hats, progression/level-2 unlocks, decks). Gated by its OWN env admin password (ADMIN_PASSWORD), never the player auth; read-only.

## Acceptance Criteria

- GET /admin (password-gated via env) renders all account/character records read-only; wrong/no password -> denied; not reachable by normal players. Test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
