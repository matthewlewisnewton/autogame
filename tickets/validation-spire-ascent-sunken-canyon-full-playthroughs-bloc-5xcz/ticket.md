# validation: spire-ascent & sunken-canyon full playthroughs blocked at telepipe-new-sortie (telepipe-only hand → 'No usable card to deplete resources')

## Difficulty: easy

## Goal

REPRO (deterministic, 2/2 runs each):
  cd game
  node ../harness/validate/playthrough.mjs --preset spire-ascent --steps full --out /tmp/x
  node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full --out /tmp/y

EXPECTED: full Tier-2 playthrough runs midcombat -> card exercises -> telepipe-new-sortie -> boss encounter -> victory; all assertions evaluated.
ACTUAL: both fail in the telepipe-new-sortie sub-step with:
  'No usable card to deplete resources: [{"id":"telepipe",...},null,null,null,null,null]'
Because the failure is BEFORE the boss-encounter sub-step, every downstream assertion (encounterActivated, bossDefeated, victoryFired, bossEncounterUiVisible, bossDistinctFromAdds, telepipeVitalsPreserved...) reports FAIL. Tier-2 boss content for these two stages cannot be validated end-to-end.

ROOT CAUSE (confirmed via isolated repro harness/tmp/repro-spire-telepipe-hand.mjs):
In the full flow the telepipe step runs in fromPlaying mode (harness/validate/lib/telepipe.mjs ~L508-528). The immediately-preceding card exercise 'magma-windup-ready' sets player.hand = [magma_greatsword, null,null,null,null,null] (game/server/debugScenarios.js setupMagmaWindupReadyDebug ~L4281). The telepipe-ready scenario is then applied on top of that single-card hand:
  - spire-ascent-telepipe-ready -> setupSpireAscentTelepipeReadyExtras (debugScenarios.js ~L872) sets hand[0]=telepipe and intends hand[1]=throw_rock, but guards on 'const rockDef = CARD_DEFS.throw_rock'. throw_rock is defined ONLY in DESPERATION_CARD_DEFS (progression.js ~L2079), NOT in shared/cardDefs.json which debugScenarios.js loads as CARD_DEFS. So rockDef is undefined, the if(rockDef) block is skipped, and hand[1] stays null -> hand is telepipe-only.
  - canyon-descent-telepipe-ready -> default setupQuestTelepipeReady branch (debugScenarios.js ~L822) replaces the first occupied slot (the lone magma_greatsword) with telepipe and adds nothing else -> hand is telepipe-only; deck-backed cards only get passively redrawn ~2s later, after the harness already read the telepipe-only hand and threw.

Observed in repro (after magma-windup then telepipe scenario):
  spire-ascent-telepipe-ready -> t+0/t+0.5/t+2s: 0:telepipe | 1:null | ... (throw_rock never delivered)
  canyon-descent-telepipe-ready -> t+0..t+0.5s telepipe-only; t+2s slot1 refilled by passive draw (too late)

NOTE: the standalone step '--steps telepipe-new-sortie' for spire-ascent PASSES (deploys fresh via launch booth; hand = [telepipe, dungeon_drake, dungeon_drake, throw_rock, battle_familiar, null]). The bug is specific to the fromPlaying full-flow path where the windup single-card hand starves the telepipe-ready hand.

FIX DIRECTION: setupSpireAscentTelepipeReadyExtras must source throw_rock from DESPERATION_CARD_DEFS (or use any regular usable weapon/spell), and/or the telepipe-ready scenarios should guarantee at least one usable damage card when applied over an exhausted hand. Reference working case: frost-crossing-telepipe-ready (ice) yields a full usable hand and the ice full playthrough passes 100%.

EVIDENCE:
  harness/tmp/qa-spire/run-summary.json, harness/tmp/qa-spire2/run-summary.json
  harness/tmp/qa-canyon/run-summary.json
  harness/tmp/qa-spire-tp/run-summary.json (passing standalone)
  harness/tmp/repro-spire-telepipe-hand.mjs (isolated root-cause repro)

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
