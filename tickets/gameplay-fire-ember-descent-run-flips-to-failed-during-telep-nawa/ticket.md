# gameplay/fire (ember_descent): run flips to 'failed' during telepipe-new-sortie after a clean victory

## Difficulty: medium

## Goal

PRESET: fire (ember_descent Tier-1, objectiveType=defeat_enemies). Real infra, PostgresProvider confirmed in server.log.

REPRO: `node ../harness/validate/playthrough.mjs --preset fire --steps full`. The defeat-enemies victory + Sortie Complete overlay PASS (artifacts include 07-victory.png; overlay shown fine — unlike the ice stage_boss bug 0dkw). The driver then fails at the telepipe-new-sortie suspend step:

  error='Run did not suspend via telepipe: phase=playing runStatus=failed extracted=false suspendedRunSummary=null'

EXPECTED: after victory, placing a telepipe should SUSPEND the run (suspendedRunSummary populated, run resumable), per the telepipeScenario flow.

ACTUAL: telepipe is placed ([telepipe] placed ... in server.log) but instead of suspending, runStatus becomes 'failed' and suspendedRunSummary stays null. The post-victory run appears to fail (player death / run-fail) before/instead of suspending. godmode handling during the post-victory telepipe phase is a suspect.

EVIDENCE: harness/tmp/e2e-boss-fire/run-summary.json (ok=false, the error above), server.log shows '[telepipe] placed at (0.0, -46.5)' then no suspend. 08-telepipe-before.png present, no successful telepipe-after.

Related family: same telepipe-new-sortie post-victory machinery as autogame-uh21, but distinct symptom (run flips to failed rather than missing attack card).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
