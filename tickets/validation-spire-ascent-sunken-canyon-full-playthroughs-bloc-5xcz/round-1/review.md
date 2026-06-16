# Senior Review: validation-spire-ascent-sunken-canyon-full-playthroughs-bloc-5xcz

## Runtime health

Captured browser run is **healthy**:

- `metrics.json`: `"ok": true`, empty `pageerrors`, servers started on port 5178
- `console.log`: Vite connect + scene init only; no `pageerror` or `[fatal]` lines (benign 409 on a resource load is not a game crash)
- Screenshots and probes show telepipe suspend → hub → resume flow working for the fallback `telepipe-ready` capture

The game starts and loads cleanly in the harness capture.

## Ticket goal

Fix deterministic full Tier-2 playthrough failures at `telepipe-new-sortie` for **spire-ascent** and **sunken-canyon**, where the harness threw `No usable card to deplete resources` because telepipe-ready debug scenarios left a telepipe-only (or otherwise unusable) hand after the preceding `magma-windup-ready` card exercise in the `fromPlaying` full-flow path.

**Repro commands (from ticket):**

```bash
cd game
node ../harness/validate/playthrough.mjs --preset spire-ascent --steps full --out /tmp/x
node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full --out /tmp/y
```

## Per-criterion findings

### 1. Spire-ascent full playthrough completes end-to-end

**PASS (independently verified).**

`node ../harness/validate/playthrough.mjs --preset spire-ascent --steps full` exited 0. All stage assertions passed, including `telepipe-new-sortie`, boss encounter, and victory:

- `encounterActivated`, `bossDefeated`, `victoryFired`, `bossEncounterUiVisible`, `bossDistinctFromAdds`
- `telepipeVitalsPreserved`, `cardChargesResetOnNewSortie`

Sub-ticket 01 change (`setupSpireAscentTelepipeReadyExtras` now sources `magma_greatsword` from `CARD_DEFS` instead of the nonexistent `CARD_DEFS.throw_rock`) is sufficient for spire-ascent in practice. Note: the successful spire `preSuspend` hand had `telepipe` in slot 0, `null` in slot 1, and usable `dungeon_drake` in slot 2 — so spire currently passes partly because deck-dealt cards remain in higher slots, not because slot 1 reliably holds `magma_greatsword` after the scenario.

### 2. Sunken-canyon full playthrough completes end-to-end

**FAIL (blocking).**

`node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full` failed **2/2** runs at `telepipe-new-sortie` with the same class of error the ticket reported:

```
No usable card to deplete resources: [{"id":"telepipe",...},null,null,null,null,null]
```

and on retry:

```
No usable card to deplete resources: [{"id":"telepipe",...},{"id":"dungeon_drake",...,"remainingCharges":0,...},null,null,null,null]
```

The failure occurs **before** boss-encounter and victory assertions, so Tier-2 sunken-canyon boss content still cannot be validated end-to-end.

**Contrast:** `--steps telepipe-new-sortie` alone for sunken-canyon **passes** (fresh lobby deploy via launch booth). The bug remains specific to the `fromPlaying` full-flow path after card exercises — exactly the scenario described in the ticket root-cause analysis.

### 3. `setupSpireAscentTelepipeReadyExtras` uses a `CARD_DEFS` weapon

**PASS.** Code now looks up `CARD_DEFS.magma_greatsword` and constructs `hand[1]` with full charges. Unit test `spire-ascent-telepipe-ready deploys Tier 2 with telepipe in hand` asserts `hand[1].id === 'magma_greatsword'`.

### 4. `canyon-descent-telepipe-ready` guarantees a usable damage card alongside telepipe

**PARTIAL — isolated scenario only.**

Sub-ticket 02 added `setupCanyonDescentTelepipeReadyExtras` and wired it via `afterDeploy` on `setupQuestTelepipeReady`. The unit test for a **fresh** `canyon-descent-telepipe-ready` emit passes and asserts `hand[1].id === 'magma_greatsword'`.

However, the **full playthrough** still fails: when `canyon-descent-telepipe-ready` is applied over an existing playing session (post `magma-windup-ready`), `setupQuestTier2Deploy` → `ensurePlayerCombatHand` **skips** re-dealing because `player.hand` already has six slots from the windup exercise. The `afterDeploy` hook is supposed to overwrite `hand[0]`/`hand[1]`, but the harness still observes telepipe-only or telepipe-plus-depleted-creature hands at depletion time. The fix does not robustly satisfy the ticket's end-to-end acceptance criterion for sunken-canyon.

Relevant code interaction:

```402:411:game/server/debugScenarios.js
function ensurePlayerCombatHand(player) {
  if (!player.hand || player.hand.length === 0) {
    createDrawDeckFromSelectedDeck(player);
    initPlayerHand(player);
    // ...
  }
}
```

```815:822:game/server/debugScenarios.js
function setupQuestTelepipeReady(lobby, state, player, questId, {
  preserveVitals = true,
  afterDeploy,
} = {}) {
  setupQuestTier2Deploy(lobby, state, player, questId, { preserveVitals });
  if (afterDeploy) {
    afterDeploy(lobby, state, player);
```

### 5. Harness / vitest checks on changed files

**PASS.** `debug-scenarios.test.js` telepipe-ready tests pass (4/4 filtered). Round-1 `coverage.log` shows the server test suite completed without failures on changed paths.

### 6. Consistency with design docs

**PASS.** Changes are confined to debug-scenario hand setup for harness QA shortcuts. No changes to telepipe suspend/resume semantics, durability rules, or normal deploy flow documented in `game/docs/design.md`.

### 7. Debug scenario gating

**PASS.** Debug scenarios remain behind `ALLOW_DEBUG_SCENARIOS` and socket `debugScenario` emits (not reachable in normal gameplay). The telepipe-ready shortcuts redeploy via the same server paths (`setupQuestTier2Deploy`, `startDungeonRun`) as other quest debug deploys; they do not bypass server-side validation or persistence for real players. Normal gameplay still reaches equivalent states through lobby deploy and organic card use.

## Code quality

- Focused diff: two helpers in `debugScenarios.js`, assertions in `debug-scenarios.test.js`
- No dead code or obvious regressions in the changed paths
- `setupCanyonDescentTelepipeReadyExtras` largely duplicates `setupSpireAscentTelepipeReadyExtras` (nit, not blocking)
- Spire-ascent fix may be **fragile**: full-flow pass does not prove `hand[1]` is `magma_greatsword`; it may pass when other deck slots happen to hold charged cards

## Capture artifacts (round-1)

Fallback capture exercised generic `telepipe-ready` on Initiate Vault, not the spire/canyon presets. Probes confirm suspend/resume preservation (`preservation.preservedIds: 2`, matching layout seed). This is orthogonal to the ticket's playthrough presets but confirms the game client runs without page errors.

## Remaining gaps

1. **Sunken-canyon full playthrough still fails at `telepipe-new-sortie`** — `fromPlaying` path after card exercises leaves no usable weapon/spell for `depleteRunResources`. Standalone step passes; full flow does not. Ticket acceptance criterion unmet for half of the stated repro matrix.

See `gaps.md` for actionable remediation.

VERDICT: FAIL
