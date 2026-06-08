# Senior Review: Ether Scythe Evolution Gold/Health On Kill

## Runtime health check

PASS. The round-2 capture proves the game starts and loads cleanly:

- `metrics.json` is present and reports `"ok": true`.
- `metrics.json` has an empty `pageerrors` array.
- `console.log` contains no `pageerror` or `[fatal]` entries from game code. The only error lines are 409 auth/resource conflicts during test setup, with normal Vite connection and scene initialization logs.
- The captured gameplay reached `phase: "playing"`, `connectionState: "connected"`, `sceneInitialized: true`, and rendered the card hand/HUD.

## Acceptance criteria

### Evolved Ether Scythe grants small gold and health on kill

PASS. The evolved card id is correctly wired as `soul_reaper` via `cardEconomy.json` (`harvesting_scythe -> soul_reaper`). `soul_reaper` is defined as a weapon with conservative kill rewards: `goldOnKill: 3` and `healOnKill: 5`, while preserving the Ether Scythe economy profile of `magicStoneOnHit: 5` and `magicStoneOnKill: 15`.

The server weapon path passes `goldOnKill` and `healOnKill` into `collectConeHits()`, accumulates them only for killed enemies, applies gold to `player.currency` and `player.currencyEarnedThisRun`, and applies healing through `healPlayer()`, so HP is capped by the normal health invariant.

### Base Ether Scythe remains unchanged

PASS. The base `harvesting_scythe` data still has only its existing damage and Magic Stone economy fields. It does not define `goldOnKill` or `healOnKill`, and the new reward path is data-driven, so the base card continues to receive Magic Stones only.

### Test coverage

PASS. The recorded coverage run completed successfully: 64 test files passed and 1597 tests passed. The new/updated tests cover:

- Ether Scythe evolving into Soul Reaper.
- Soul Reaper card data including evolved status, gold-on-kill, and heal-on-kill.
- Cone-hit behavior rewarding gold/heal only on kills, not hits.
- Healing application respecting `MAX_HP`.
- Socket integration for Soul Reaper applying currency, run-earned currency, health, and Magic Stones.
- Existing Ether Scythe behavior remaining Magic Stone-only.

## Design and foundation consistency

PASS. The implementation fits the design document's loot/economy and combat-card model: enemies can provide currency rewards, and weapons remain multi-charge active combat cards. The reward amounts are conservative and harvest-themed, and they do not alter the foundation requirements for 3D rendering, server-client connectivity, player visualization, or movement synchronization.

## Debug scenarios

PASS. This ticket adjusted a `canyon-descent-boss-low-hp` debug-scenario race by clamping the boss to 1 HP immediately before the authoritative snapshot. The shortcut remains in the server debug-scenario path, is exercised only through the existing debug-scenario socket/URL mechanism, and the normal equivalent state remains reachable through the regular stage-boss flow: deploy the Canyon Descent tier-2 run, clear adds, activate/lock the encounter, then damage the boss to low HP. The scenario does not replace or weaken the normal run setup, encounter activation, or boss-lock invariants.

## Code quality

PASS. The changes are small and follow existing patterns: shared card data remains the source of truth, client/server card definitions stay aligned, server combat uses existing hit collection and healing helpers, and tests are focused on the new behavior. I found no dead code, broken exports, or console/runtime errors attributable to the ticket.

## Remaining gaps

None.

VERDICT: PASS
