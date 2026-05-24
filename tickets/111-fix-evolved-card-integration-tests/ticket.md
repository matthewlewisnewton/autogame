# Fix evolved card 063–066 integration tests

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

`0be7d29` renamed evolved card IDs (063–066) and added two new test files claiming to cover `astral_guardian` and `ancient_wyrm`. Both tests are silently broken: after the multi-lobby refactor (`2fb2825`) players only appear in `gameState.players` once they join a lobby, but the new tests access `gameState.players[socket._playerId]` directly without ever calling the lobby join helpers. The lookup returns `undefined` and the test throws a `TypeError` — the live `useCard` paths are not exercised, despite the commit message claiming integration coverage. There is also no save migration for the renamed card IDs.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/test/astral_guardian.test.js:164` — `gameState.players[socket._playerId]` without a prior `connectAndJoinLobby` call.
- `game/server/test/ancient_wyrm.test.js:135` — same pattern, same failure.
- `game/server/test/helpers.js` — exports `connectAndJoinLobby` used throughout `integration.test.js`; the new files duplicate ~70 lines of bootstrapping rather than importing from helpers.
- `game/server/test/astral_guardian.test.js:235-272` — test titled "minion attacks faster than default minions" actually compares damage per tick (10 vs 5), not interval cadence. Rename or fix the assertion.
- `game/client/cards.js` — `EVOLUTION_TRANSFORMS` and `CARD_SELL_VALUES` were updated to the new IDs (`steel_claymore`, `magma_greatsword`, `astral_guardian`, `ancient_wyrm`) with no migration for existing saves referencing the old IDs (`steel_broadsword`, `inferno_edge`, `guardian_familiar`, `ancient_drake`). `resolveDeckCardId` will treat them as unknown.
- `TASKS.md` — `0be7d29` ticks tickets 055 and 057 done despite no code changes in those areas in that commit; verify those tickets were genuinely completed elsewhere or unmark them.

## Acceptance Criteria

- Both new test files actually exercise the live `useCard` path: players are joined to a lobby before any `gameState.players[...]` access, ideally via the shared `connectAndJoinLobby` helper.
- Tests are renamed (or assertions corrected) so each `it()` describes what it actually checks.
- Shared bootstrap is imported from `helpers.js`; the duplicated ~70 lines are removed.
- A save-migration shim maps the old evolved card IDs to the new ones so loading a pre-`0be7d29` save does not corrupt decks. Add a test that loads a save containing each old ID and asserts the deck resolves to the new IDs.
- `TASKS.md` checkbox state for tickets 055/057 reflects the actual code state.

## Technical Specs

- Likely files: `game/server/test/astral_guardian.test.js`, `game/server/test/ancient_wyrm.test.js`, `game/server/test/helpers.js`, `game/client/cards.js`, `game/server/progression.js` (`resolveDeckCardId`), `TASKS.md`.
- Keep server-authoritative stat fields (`shieldHp`, `breath*`, etc.) on the server side; this ticket does not require mirroring them into the client `CARD_DEFS`.

## Verification: code
