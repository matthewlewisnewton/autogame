# Senior Review: 313-saber-of-light-aoe-per-grind-scaling

## Runtime health

The captured game run is healthy. `metrics.json` reports `"ok": true`, the page reached a connected playing state with canvas and card hand visible, `pageerrors` is empty, and `pageerrors.json` is `[]`. `console.log` contains only normal Vite connection and scene initialization messages. `client.log` has benign THREE deprecation warnings and Vite websocket `EPIPE` lines on shutdown, which are explicitly non-blocking environment noise.

## Acceptance criteria

### Saber of Light gains a small AoE increase per grind level

Mostly satisfied in live combat code. `game/shared/cardStats.json` adds `attackRange: 5` and `aoeGrindScale: 0.03` to `saber_of_light`. `game/server/cardEffects.js` resolves weapon reach through `effectiveAttackRange(cardDef, grind)`, which applies `base * (1 + grind * aoeGrindScale)` only for opted-in cards. This means Saber of Light widens by 3% per grind level while other weapons without `aoeGrindScale` remain unchanged.

### Saber remains fast

Satisfied. `saber_of_light.cooldownMs` remains 400ms, and the weapon branch still applies `cardDef.cooldownMs || COOLDOWN_MS` for slot cooldowns.

### Base damage and cooldown unchanged

Satisfied. `saber_of_light.damage` remains 12 and `cooldownMs` remains 400 in `game/shared/cardStats.json`; the new test asserts both values.

### Test coverage

Satisfied for the core combat/stat change. `game/server/test/saber_aoe_grind.test.js` covers base damage/cooldown preservation, gentle positive reach scaling, no scaling for a control weapon, and fallback reach. The recorded coverage run passed: 109 test files and 1778 tests, including `server/test/saber_aoe_grind.test.js` with 5 tests.

## Design and requirements fit

The core Saber change is consistent with the card-combat design: it preserves the weapon identity and fast cooldown while improving reach through the existing grind progression concept. The captured run also preserves the foundation requirements: the 3D scene initializes, the client connects to the server, players enter gameplay, and movement/dodge probes update state.

## Debug scenario review

This ticket added the `saber-grind-max` debug scenario. It is gated behind the existing debug path: the client only requests URL-driven scenarios from `?debugScenario=...` on localhost, and the server checks `isDebugScenarioAllowed()` before applying the scenario.

However, the scenario does not preserve the normal gameplay end-state when the player does not already have Saber of Light in hand. It fabricates `{ id: 'saber_of_light', charges: 5, remainingCharges: 5, grind: 10 }`, while the real card definition in `game/shared/cardDefs.json` gives Saber of Light 6 charges. A normal +10 Saber deployed from owned/grinded inventory is a 6-charge weapon, so the shortcut creates an impossible card state and weakens the invariant that debug scenarios mirror reachable gameplay states.

## Remaining gaps

1. `saber-grind-max` fabricates an impossible 5-charge Saber of Light when no Saber is already in hand. A real Saber has 6 charges, so the debug shortcut is not equivalent to a reachable normal gameplay state.

VERDICT: FAIL
