# Vault Wyrm / Archive Wyrm summon and fire-breath VFX

Polish `dungeon_drake` (Vault Wyrm) and `ancient_wyrm` (Archive Wyrm) with recognizable summon flourishes and richer fire-breath attack visuals using the 315 shared primitives. Wyrm attacks already route through `renderWyrmAttack` via server `_pendingMinionBreaths` `cardUsed` events; this pass upgrades those visuals and gives both wyrm types distinct summon-in palettes on top of sub-ticket 01.

## Acceptance Criteria

- `renderWyrmAttack` in `cardRenderers.js` composes at least two 315 primitives on breath **start** (`breathPhase !== 'tick'`): e.g. `spawnTelegraphRing` at the cone base, `spawnParticleBurst` along the breath direction, and `spawnHitSpark`/`spawnParticleBurst` on each `data.hits` entry (tick phase continues to skip duplicate cones per existing behavior).
- Fire breath (`specialEffect === 'fire_breath'`) uses warm red/orange primitives; melee Vault Wyrm breath uses the card accent with green fallback — matching existing color logic but with added burst/ring layers.
- Per-card summon overrides for `dungeon_drake` and `ancient_wyrm` in `CARD_RENDERERS` (or a shared `renderWyrmSummon`) apply distinct accent radii/particle counts on top of the sub-ticket 01 default creature summon (Vault Wyrm: smaller tight burst; Archive Wyrm: wider ring + more embers).
- `game/client/renderer.js` minion-damage fallback for `ancient_wyrm` (~line 5672) optionally adds a `spawnParticleBurst` at the enemy hit point so off-tick damage still reads as fire (guard with primitive presence checks).
- `game/client/test/cardRenderers.test.js` extends existing Vault Wyrm / Archive Wyrm cases to assert the new primitive calls and accent colors; summon tests assert per-card radii differ between `dungeon_drake` and `ancient_wyrm`.
- No new per-frame allocations in `updateAttackEffects`; reuse existing effect pools.

## Technical Specs

- `game/client/cardRenderers.js`: enhance `renderWyrmAttack` (~line 232); add `renderWyrmSummon` entries for `dungeon_drake` and `ancient_wyrm` composed with the sub-ticket 01 summon helper (array renderer: `[renderWyrmSummon, renderWyrmAttack]` only fires attack half on minion breath payloads — use `data.breathPhase` / absence of `minionId` to distinguish summon vs attack, or split registry entries).
- `game/client/renderer.js`: optional fallback burst in the `fromAncientWyrm` branch of the enemy HP-drop handler.
- `game/client/test/cardRenderers.test.js`: new/updated assertions for breath-start primitives and per-wyrm summon styling.

## Verification: code
