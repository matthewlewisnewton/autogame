# Verify completion — all 093 nits resolved

Round-4 review found all three acceptance criteria met (monster capture proof, client test, capture-plan slot references) with **VERDICT: PASS** and no open gaps. This sub-ticket confirms the codebase state: all changes are committed, tests pass, and capture artifacts are clean.

## Acceptance Criteria

- `game/client/test/main.test.js` contains a test for monster happy-path authority that asserts `drawCard` is never called and `hand[slot]` matches server `stateUpdate`.
- `game/server/index.js` contains a `monster-card` debug scenario that guarantees a monster card in hand.
- `lobby.png/capture-plan-gemini.txt` uses `cardType: "monster"` (not hard-coded slot indices) for card identification.
- Full test suite passes: `pnpm run test` yields 331 passing tests with zero failures.

## Technical Specs

- **File:** `game/client/test/main.test.js` — verify monster authority test exists (~line 1337).
- **File:** `game/server/index.js` — verify `monster-card` debug scenario exists (~line 995).
- **File:** `lobby.png/capture-plan-gemini.txt` — verify `cardType` targeting, no slot-index card references.
- Run `cd game && pnpm run test` to confirm 331 tests pass.

## Verification: code
