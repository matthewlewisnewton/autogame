## Remove Unused Simulation Import

`game/server/simulation.js` imports `STARTING_MAGIC_STONES` from `config`, but the symbol is not used in the file after the final telepipe reset probe cleanup. Removing it keeps the server module free of dead imports.

### Acceptance Criteria
- `game/server/simulation.js` no longer imports `STARTING_MAGIC_STONES`.
- The existing server/client test suite still passes.
