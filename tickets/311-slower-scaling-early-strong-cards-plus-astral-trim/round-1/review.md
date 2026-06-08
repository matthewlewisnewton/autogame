## Per-Criterion Findings

### Runtime health

PASS. The captured game run loaded cleanly. `metrics.json` reports `"ok": true`, the run reached `phase: "playing"` with an initialized scene/canvas, connected clients, lobby-to-gameplay transition, movement probes, and an empty `pageerrors` array. `console.log` has Vite connection logs, two 409 resource/auth conflicts during setup, and scene initialization messages, but no `pageerror` or `[fatal]` lines from game code.

The `metrics.json` screenshot entries reference `01-initial.png` through `04-after-dodge.png`, but no `.png` files are present in the round folder. The runtime probes and logs are still sufficient for this balance-focused ticket, and the missing image files do not by themselves show a gameplay defect.

### Signal Familiar keeps base power but scales more slowly per grind

PASS. `game/shared/cardStats.json` keeps `battle_familiar` at its original base `magicStoneCost: 50` and `damage: 44`, so the early reward power is preserved. `game/server/progression.js` adds `CARD_GRIND_STAT_SCALE.battle_familiar = 0.03` while the global grind scale remains `0.05`, and `scaledGrindStat(base, grind, cardId)` now uses the per-card scale when a tuned card id is provided.

The live card-use path passes `data.cardId` into spell radial damage and astral-style summon stat scaling in `game/server/cardEffects.js`, so Signal Familiar's burst and default minion body now grow at the slower curve while other cards retain the default curve. `game/server/test/card_grinding.test.js` covers base grind-0 behavior and the lower grind-5 curve.

### Phase Stalker keeps base power but scales more slowly per grind

PASS. `game/shared/cardStats.json` keeps `null_crawler` at `magicStoneCost: 35`, `minionHp: 55`, `attackDamage: 22`, and its existing beam parameters. `game/server/progression.js` adds `CARD_GRIND_STAT_SCALE.null_crawler = 0.03`, and `game/server/cardEffects.js` now applies `scaledGrindStat(..., 'null_crawler')` to the spawned minion HP/TTL and its beam `attackDamage`.

The Phase Stalker tests verify the base spawn stats remain unchanged at grind 0, high-grind stats are below the global curve, and beam hits use the scaled attack damage.

### Astral Guardian is conservatively trimmed while remaining top-tier

PASS. `game/shared/cardStats.json` trims `astral_guardian.damage` from 66 to 63 and `shieldHp` from 15 to 14, while preserving `magicStoneCost: 65`, evolved identity, `effect: "astral_guardian"`, shield duration, minion HP, minion TTL, and attack damage. This is a small direct late-card trim rather than a grind-scaling change, matching the ticket's direction.

`game/server/test/astral_guardian.test.js` was updated for the new shield and damage values and still verifies evolution from Signal Familiar, shield absorption, card play, AoE, and minion spawn behavior.

### Tests and 303 balance report

FAIL. The ticket-specific tests in the supplied coverage run passed: `astral_guardian.test.js`, `card_balance_metrics.test.js`, `creature_minions.test.js`, and `card_grinding.test.js` are all green. `game/validation/card-balance/report.md` was updated with the Ticket 311 rows and summary for Signal Familiar, Phase Stalker, and Astral Guardian.

However, the same `coverage.log` ends with a failing overall Vitest run: `server/test/debug-scenarios.test.js > debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` failed because `approachResult.ok` was `false`. The ticket acceptance explicitly includes tests, so the submitted validation state is not fully green.

### Design and requirements consistency

PASS. The changes stay within the documented card-combat model: cards retain their spell/creature/evolved roles, grind still works through the existing progression system, and no lobby, rendering, WebSocket, movement, or multiplayer foundation behavior in `game/docs/requirements.md` is changed. No production gameplay path was replaced by a debug scenario, and this ticket did not add or change a `?debugScenario=` shortcut.

### Code quality

PASS for the balance implementation. The per-card scale is centralized in `progression.js`, exported through `index.js` for tests, and used at the affected runtime card-effect call sites. Existing callers without a card id continue using the global `GRIND_STAT_SCALE`. I did not find dead code or a code path that would gut the target cards' base power.

## Remaining gaps

1. The overall Vitest coverage run is failing in `server/test/debug-scenarios.test.js` for `arena-trials-boss-approach`, so the ticket's "tests" acceptance criterion is not met. This appears unrelated to the balance implementation, but it is still a blocking validation failure in the submitted codebase.

VERDICT: FAIL
