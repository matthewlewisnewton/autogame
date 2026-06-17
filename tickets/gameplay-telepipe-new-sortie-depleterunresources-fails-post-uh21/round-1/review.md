# Senior Review — gameplay/telepipe-new-sortie: depleteRunResources fails

## Runtime health (blocking gate)

PASS. `round-1/metrics.json` reports `"ok": true`, `"pageerrors": []`, and no
`harness_failure` block. `pageerrors.json` is `[]`. `console.log` shows a clean
boot: `[initScene] Initializing Three.js scene...`, `[debugScenario] applied
telepipe-ready`, scene initialized, suspend→resume completed. The single
`[A:error] Failed to load resource: ... 401 (Unauthorized)` is the expected
pre-login resource probe before the session cookie is established — the page
then authenticates and runs normally; it is not an uncaught page error or a
game-code fault. `01-in-dungeon.png` confirms the game renders (dungeon, HP/MS
bars, telepipe + combat cards in hand). The game starts and loads cleanly.

## What the ticket asked for

The harness telepipe-new-sortie depletion probe (`harness/validate/lib/
telepipe.mjs`) intermittently hard-fails with "No usable card to deplete
resources" when the post-victory hand collapses to `[telepipe, null×5]` before
magic stones drop below the depletion threshold. Expected: the depletion phase
should deterministically have a usable attack / depleted-resource state.

## Findings per the diagnosis + acceptance

- **Root cause correctly identified and fixed game-side.** `depleteRunResources`
  needs `magicStones < STARTING_MAGIC_STONES` **and** a depleted-charge hand card
  simultaneously. The canyon/spire `telepipe-ready` scenarios previously deployed
  near full MS; weapon swings *gain* MS, so combat cards exhausted to telepipe-
  only before MS ever fell below the threshold → the flaky failure. The fix
  (`game/server/debugScenarios.js:905-906`, `939-940`) deploys
  `setupSpireAscentTelepipeReadyExtras` / `setupCanyonDescentTelepipeReadyExtras`
  with `player.magicStones = 20` plus `_msRegenGraceUntil = Date.now() + 20000`,
  pre-satisfying the `msDepleted` half so a single greatsword swing completes
  depletion before any card exhausts. This deterministically removes the failure
  mode. **Met.**

- **Mechanism is real and consistent.** `_msRegenGraceUntil` is honored by
  `regenMagicStones()` (`game/server/simulation.js:4051-4055`), which freezes MS
  during the grace window rather than regenerating it back toward MAX. The same
  MS-20 + grace pattern is already used by the sibling `frost-crossing-telepipe-
  ready` scenario and the suspended-checkpoint path
  (`debugScenarios.js:724-728`), so this is mirroring an established, tested
  pattern, not inventing a new one. **Met.**

- **Scope is correct.** The fix lives in `game/`, not `harness/validate/
  telepipe.mjs` — appropriate, since uncommitted harness edits are reverted by
  the live supervisor and would never merge. **Good call.**

- **Debug-scenario invariants intact.** This ticket did not add a new
  `?debugScenario=` entry point; it tweaks the starting MS inside two *existing*
  debug-only scenarios. The change does not bypass server validation,
  persistence, or replication — deploying at 20 MS is a state a real player
  reaches naturally mid-run, and depletion still proceeds through the normal
  attack/regen simulation path. No invariant is weakened. **No blocking gap.**

- **Tests.** `npx vitest run server/test/debug-scenarios.test.js -t
  "telepipe-ready"` → 5 passed. New assertions
  (`debug-scenarios.test.js:1147-1158`, `1609-1620`) lock in `magicStones === 20`
  and `magicStones < STARTING_MAGIC_STONES` for both presets. **Met.**

## Note (non-blocking)

The fallback capture exercised the generic `telepipe-ready` scenario (probe shows
MS 99/99), not the canyon/spire `telepipe-ready` scenarios that were actually
changed. The captured run therefore proves runtime health but does not visually
exercise the changed code paths. Those paths are covered by the unit tests, and
the change is a 2-line MS adjustment per scenario, so this does not block — noted
in nits.

## Remaining gaps

None. The game runs cleanly and the depletion failure mode is deterministically
eliminated for both presets, with unit coverage.

VERDICT: PASS
