# Monolithic Codebase Split and Modularization

> **Staleness note.** This follow-up ticket was written against commit
> `dc999ac` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Refactor the massive single-file client and server entrypoints to make the codebase more maintainable, readable, and easier to unit-test.

## Modularize client-side `main.js` (58KB)

`game/client/main.js` contains a massive mix of:
- Three.js scene configuration, rendering tick, camera controls, light rigs, and visual effect systems (particle explosions, sparks, damage numbers, and health bars).
- DOM interaction, lobby state UI updating, and deck editor rendering.
- Socket.IO connection event routing and command handling.
- Oscillator-based Web Audio synthesizer system.

### Acceptance Criteria
- Extract the Three.js rendering layer, particle effects, health-bar mesh generation, floating damage numbers, and camera follow updates into a dedicated rendering module (e.g. `game/client/renderer.js`).
- Extract the audio configuration, sound synthesizer constants, and `playSound` function into an audio module (e.g. `game/client/audio.js`).
- Keep `game/client/main.js` focused primarily on socket orchestration, user inputs (keyboard / mouse clicks), state reconciliation, and DOM layout/UI triggers.
- Ensure all existing client unit tests still pass without code quality regression.

## Modularize server-side `index.js` (40KB)

`game/server/index.js` currently serves as:
- An Express and Socket.IO routing handler.
- A game loop tick manager that runs wander AI, minion updates, and item decays.
- A player account progression builder and rewards dealer.
- A mock scenario driver for debug hooks.

### Acceptance Criteria
- Extract tick-based entity AI logic (wander states, minion chase, attack validations) into a separate AI or gameplay simulation module (e.g. `game/server/simulation.js` or similar).
- Extract reward rotation logic (`VICTORY_REWARD_ROTATION`), currency grants, and deck validation logic into a player progress helper module (e.g. `game/server/progression.js`).
- Maintain Express, Socket.IO bootstrapping, and route delegation in `game/server/index.js`.
- Total test coverage must remain above 95% and the existing tests must pass successfully.
