# Senior review — 308 apply wind-up and lower charges to heavy-hitter cards

## Runtime health (capture)

`round-2/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`.
`console.log` shows a clean full-flow smoke (auth → lobby → ready → playing);
no `pageerror` / `[fatal]` lines from game code. The probe HUD confirms Solar
Edge renders in hand at `2/2` charges in live play. **Game runs and loads
cleanly.**

## Per-criterion findings

### DO 1 — Wind-up window on the heaviest hitters
**Met.** `game/shared/cardStats.json`:
- `flame_blade` gains `"windUpMs": 600` (this ticket).
- `magma_greatsword` carries `"windUpMs": 800` (larger hit → longer commit),
  pre-existing from 307 and correctly left in place.

Both flow through the deferred `processPendingCardWindups` / commit path. Unit
+ integration coverage in `server/test/card_windup_resolution.test.js` proves:
damage and `cardUsed` fire only after `windUpMs`, the player is committed
(`isPlayerCardCommitted`) during the window, death cancels the pending hit, and
a no-windUp weapon (`iron_sword`) still resolves instantly. Both heavy hitters
are the report's flagged power-spike outliers (`report.md` weapon table), and
damage is untouched (flame_blade 28, magma 42/86-burst) — committed, not gutted.

### DO 2 — Lower charges on the super-hard-hitters
**Met.** `game/shared/cardDefs.json`: `flame_blade` 3 → 2, `magma_greatsword`
4 → 3. Verified live (probe HUD shows Solar Edge `2/2`) and in
`server/test/debug_scenarios_charges.test.js` + `client/test/cards.test.js`.
Fast multi-swing weapons (`excalibur_photon`) were correctly left alone per the
ticket's explicit exclusion.

### DO 3 — Card description / render conveys the heavy wind-up
**NOT met — blocking.** A `description` string was added to both cards in
`cardDefs.json` ("…locks you during wind-up" / "…commits you during wind-up"),
but **that field is never rendered to the player**:
- In-game hand (`renderHand`, `game/client/main.js`) shows only name + charge
  count — no description, no wind-up indicator (probe `bodyText` confirms:
  `"…Solar Edge\n2/2"`).
- The reward-choice UI (`main.js:4435`) renders `choice.description`, which the
  server builds via `cardChoiceDescription(def)` in `game/server/progression.js`
  — that helper derives text from `specialEffect`/type/damage and **ignores
  `def.description`**. So flame_blade shows the generic "deals N damage" weapon
  copy and magma_greatsword shows "fire trail"; neither mentions wind-up.
- The deck/forge viewer (`main.js:~3632`) renders name + stat rows only; no
  `def.description`.

The only `def.description` reads in the client are for key items (`main.js:3421`)
and the enemy-variant codex (`main.js:2942`) — not cards. The 03 commit message
claims the text shows "in the codex, deck viewer, and reward-choice UI," but
none of those paths read it. The acceptance line "card text reflects it" is
therefore unsatisfied: no player-facing card text conveys the wind-up commitment.

### Debug scenario (`flame-blade-windup-ready`)
**OK.** Registered only in the `DEBUG_SCENARIOS` set (`server/index.js:559`) and
reached solely via the gated `debugScenario` socket path (`debugScenarioAllowed`
/ `ALLOW_DEBUG_SCENARIOS`). The end-state (Solar Edge in hand + a grunt in melee
range) is reachable through normal play — flame_blade is a reward card already in
the default deck (see probe inventory) — and the scenario charges are derived
from `CARD_DEFS` rather than hard-coded, so it cannot drift from the real values.
It sets up state without skipping any validation/replication that normal play
exercises. Good practice.

### Design / regression consistency
Consistent with `game/docs/design.md`; no foundation regression. Charge/wind-up
changes are data-only plus the new gated scenario; existing tests updated for the
new charge values (`client/test/main.test.js`, `server/test/*`). Target suite
green (30/30 on the windup/charges/cards files).

## Remaining gaps

1. **(Blocking, AC DO-3 / "card text reflects it")** The `description` field
   added to `flame_blade` and `magma_greatsword` in `cardDefs.json` is dead data
   — no card UI renders it, so the wind-up commitment is never conveyed in card
   text. `cardChoiceDescription(def)` ignores `def.description`. Fix: surface
   `def.description` in a player-facing card path (simplest: have
   `cardChoiceDescription` return `def.description` when present so the
   reward-choice screen shows it).

VERDICT: FAIL
