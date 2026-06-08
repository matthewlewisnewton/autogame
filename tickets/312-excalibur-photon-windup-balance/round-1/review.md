# Review: 312-excalibur-photon-windup-balance

## Runtime health

PASS. The captured run is valid: `metrics.json` reports `"ok": true`, no harness startup failure, and `pageerrors: []`. `console.log` contains only Vite connection messages, scene initialization, and launch-booth ready-up logs; there are no `pageerror` or `[fatal]` entries from game code. The screenshots and probes show a normal lobby-to-gameplay flow with two players, a live canvas, connected socket state, movement, combat HUD, enemies, and key-item cooldown behavior.

## Acceptance criteria

### `excalibur_photon` has a wind-up lockout

PASS. `game/shared/cardStats.json` defines `excalibur_photon.windUpMs` as `600`, and the live merged `CARD_DEFS` path exposes that value through server tests. This uses the existing 307 wind-up mechanic rather than adding a parallel implementation.

### Sustained DPS/DPM moves toward the weapon band

PASS. The balance analyzer now includes positive `windUpMs` in `effectiveCycleMs`, so `damagePerMs` reflects `cooldownMs + windUpMs` for wind-up cards while leaving instant cards on the prior cooldown-only formula. For Excalibur Photon, the effective cycle is 200 ms cooldown + 600 ms wind-up, so 28 damage per use lands at 0.035 damage/ms instead of the prior 0.14 cooldown-only value. That is materially closer to the report's weapon Q3 area without fully flattening the evolved-card identity.

### Per-hit damage unchanged

PASS. Excalibur Photon remains `damage: 14`, `cooldownMs: 200`, `charges: 6`, and `swingsPerUse: 2`; only `windUpMs` was added. The behavior test proves the delayed resolution still applies two 14-damage cone hits after wind-up, preserving the 28-damage burst feel.

### Test coverage

PASS. Coverage log shows `25` test files and `496` tests passing. New and updated tests cover the wind-up-aware balance calculation, Excalibur Photon stat exposure, evolution/new-card expectations, generic instant-card regression, and a live socket `useCard` path where Excalibur Photon commits wind-up, deals no early damage, resolves after `windUpMs`, applies two hits, and clears commitment state. Coverage output includes unrelated stderr from existing test-time model URL fallbacks and socket disconnect cleanup, but the suite passes and the captured browser run is clean.

## Design and requirements consistency

PASS. The change remains within the documented card-combat model: Excalibur Photon is still a weapon card in the active deck combat loop, and the wind-up/recovery lock is consistent with existing wind-up cards such as Steel Claymore and Corebreaker Greatsword. The implementation does not affect the foundational requirements for Three.js rendering, websocket connection, multiplayer visualization, or movement sync; the capture verifies those still run.

## Debug scenarios

PASS. This ticket did not add or change a development `?debugScenario=` entry. The new tests seed state directly or use an existing debug scenario for Magma Greatsword regression coverage; normal gameplay remains the only route for real players to obtain and use Excalibur Photon through the existing card/evolution systems.

## Code quality

PASS. The code change is appropriately narrow: one data-field addition, balance-metric accounting for `windUpMs`, report reconciliation, and targeted regression/integration tests. The existing wind-up pipeline locks cost/cooldown/origin at commit, resolves from `pendingCardUse`, applies `swingsPerUse` during deferred resolution, and clears commitment after use. I did not find dead code, duplicated gameplay paths, or a mismatch between stats, report, and tests.

## Remaining gaps

None.

VERDICT: PASS
