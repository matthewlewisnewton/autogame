1. Spike Trap only has a short placement flourish; the armed trap is invisible while it persists server-side for `ttlMs: 30000`, and trigger damage has no synced visual feedback.
   Files: `game/client/renderer.js`, `game/client/main.js`, `game/client/cardRenderers.js`, `game/server/simulation.js`, `game/shared/cardStats.json`
   Fix: render active `spike_trap` entries from `gameState.enchantments` as persistent steel/red ground hazards until removed, and add synced trigger/hit feedback when the trap fires or disappears.
