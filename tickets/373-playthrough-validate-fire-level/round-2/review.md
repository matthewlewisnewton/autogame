# Review: 373-playthrough-validate-fire-level

## Runtime Health

PASS. The `round-2/metrics.json` capture has `"ok": true`, no `pageerrors`, and no `harness_failure`. `round-2/console.log` contains normal Vite/debug startup output plus one non-fatal 409 resource response; there are no `pageerror` or `[fatal]` lines from game code. The captured game starts, connects, renders a canvas, and loads cleanly.

## Acceptance Criteria Findings

- **Add a fire-level preset plus debug scenarios to the playthrough driver:** Mostly satisfied. `harness/validate/presets/fire.mjs` wires the `fire` preset to `ember_descent`, `fire-cavern`, defeat-enemies flow, fire combat probes, card mechanics probes, and fire telepipe reset. The package scripts expose `validate:fire` and `validate:fire:check`. The debug entry points remain behind the existing debug scenario path and are not normal gameplay entry points.

- **Deploy into the fire level and exercise new fire-level content:** Partially satisfied. The saved `game/validation/fire/run-summary.json` shows `ember_descent` tier 1 deployed with `layoutProfile: "fire-cavern"`, six live enemies including `ember_wraith`, and floor alignment probes on the fire-cavern layout. Combat and victory artifacts exist. However, the fire-enemy burn validation does not prove the requested burning DoT or animation: `emberBurn.hpBefore` is `100`, `hpAfterTicks` is `100`, `hpDelta` is `0`, and `04-ember-burn.png` is already obscured by the Sortie Complete overlay rather than showing the player burning in combat.

- **Fire enemy lights the player on fire, with ticking damage and animation:** FAIL. The status flag was observed (`playerBurningUntil` was set), but the validation accepted zero HP change and the screenshot does not show the burn visual. This leaves the explicit "burning ticking damage" and "animation" requirement unverified.

- **Stage boss, boss health bar, and distinct boss visuals:** Acceptable for the current content state. `game/server/quests.js` defines `ember_descent` tier 1 as a `defeat_enemies` quest with no `encounter`, and `game/validation/fire/findings.md` explicitly notes that the fire level currently has no stage boss, so boss UI/visual checks are N/A for this tier.

- **Slow card, burn card, heal/cleanse card, and wind-up card:** Partially satisfied. The card probes show burn status applied to an enemy, slow applying after burn and clearing burn, Purifying Pulse healing/cleansing, and Corebreaker wind-up entering input lock with the telegraph flag. However, the cleanse scenario now seeds both `burningUntil` and `slowedUntil` at the same time even though the server enforces burn/slow mutual exclusion elsewhere. That debug shortcut creates an impossible state and weakens the invariant the validation is supposed to protect.

- **Telepipe vitals persistence and card-charge reset on new sortie:** Satisfied. The fire artifacts record HP/MS persisting from `60/20` through a fresh fire sortie, run id changing, and the depleted `iron_sword` returning from `25/30` to `30/30`.

- **Screenshots and findings:** Partially satisfied. The required fire artifact files and screenshots exist, and `findings.md` summarizes the run. The blocking issue is that the ember-burn screenshot and assertions are not strong enough to substantiate burn tick damage or animation.

## Design and Regression Check

The fire tier is consistent with the existing quest model: `ember_descent` is a tier-1 `defeat_enemies` level with an `ember_wraith` enemy pool and no stage boss encounter. The implementation does not appear to regress the baseline requirements for rendering, client/server connection, player visualization, or movement synchronization. Coverage completed with `137` test files and `2078` tests passing.

## Remaining gaps

1. Fire-enemy burn validation does not prove the required burning DoT or visual animation. The captured summary records `hpDelta: 0`, and `04-ember-burn.png` is a victory overlay rather than an in-combat burning screenshot.

2. The Purifying Pulse debug setup used by the fire card-mechanics validation creates an impossible burn-plus-slow state, despite burn and slow being mutually exclusive by design.

VERDICT: FAIL
