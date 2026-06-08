## Runtime health

The captured game run is healthy. `metrics.json` reports `"ok": true`, the lobby-to-gameplay smoke flow reached `phase: "playing"` with a live Three.js canvas, and `pageerrors` is empty. `console.log` has no `pageerror` or `[fatal]` entries from game code; the only notable browser console errors are non-fatal HTTP 409 resource responses during auth setup.

## Acceptance criteria

### Evolved Ether Scythe grants small gold and health on kill

Satisfied functionally. The evolved card id is `soul_reaper`, registered as the evolution target for `harvesting_scythe`. Its shared stats add conservative kill rewards: `goldOnKill: 3` and `healOnKill: 5`, while preserving the base scythe's existing damage and Magic Stone economy. The server weapon path passes these fields into cone-hit resolution, accumulates rewards only when `damageEnemy()` reports a kill, credits `player.currency` and `currencyEarnedThisRun`, and applies healing through `healPlayer()`, which caps at `MAX_HP`.

### Base Ether Scythe unchanged

Satisfied. `harvesting_scythe` remains a reward weapon with `damage: 12`, `magicStoneOnHit: 5`, and `magicStoneOnKill: 15`; it does not define `goldOnKill` or `healOnKill`. Existing Ether Scythe socket coverage still verifies Magic Stone gain without the new kill rewards.

### Test coverage

Partially satisfied but blocked by the overall recorded vitest run. The ticket adds focused coverage for card data, evolution mapping, unit-level kill reward accounting, max-HP healing cap behavior, and an integration `useCard` path that verifies Soul Reaper grants Magic Stones, gold, and health on a kill. Those focused tests passed in the recorded coverage output.

However, the same `coverage.log` ends with a failing test outside the scythe path:

`server/test/debug-scenarios.test.js > debugScenario — canyon-descent-tier-2 > positions miniboss at 1 HP beside the player in playing phase`

The assertion expected the miniboss HP to be `1`, but received `300`. Because the ticket verification asks for the harness checks to pass, this leaves the quality gate non-green even though the Soul Reaper implementation itself is correct.

## Design and requirements consistency

The implementation is consistent with the design's card-driven combat and loot/economy loop. The reward is tied to a weapon kill during normal gameplay, uses existing server-authoritative combat state, and updates the same player currency and HP fields already surfaced in HUD state snapshots. The captured run also preserves the foundation requirements: the client renders, connects to the server, shows multiplayer state, and movement/dodge probes remain functional.

No debug scenario was added or changed for this ticket.

## Remaining gaps

1. The recorded vitest coverage run is failing in `server/test/debug-scenarios.test.js`: the `canyon-descent-tier-2` debug scenario no longer leaves the miniboss at 1 HP, receiving 300 HP instead. This is outside the Soul Reaper implementation path, but it blocks the ticket's requested harness-check verification until fixed or explicitly rerun green.

VERDICT: FAIL
