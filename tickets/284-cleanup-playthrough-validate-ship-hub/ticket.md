# Cleanup nits from 281-playthrough-validate-ship-hub

> **Staleness note.** This follow-up ticket was written against commit
> `fd1a58b6` (2026-06-06). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `281-playthrough-validate-ship-hub`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove Unused Simulation Import

`game/server/simulation.js` imports `STARTING_MAGIC_STONES` from `config`, but the symbol is not used in the file after the final telepipe reset probe cleanup. Removing it keeps the server module free of dead imports.

### Acceptance Criteria
- `game/server/simulation.js` no longer imports `STARTING_MAGIC_STONES`.
- The existing server/client test suite still passes.
