1. Live capture fails telepipe vitals preservation: `metrics.json` is `ok:false` and `console.log` reports HP `80 -> 40` plus unchanged runId during redeploy.
   Files: game/server/debugScenarios.js, game/server/progression.js, game/server/test/integration.test.js
   Fix: Make the ticket's runnable validation path deterministic and passing: use an ice-specific telepipe scenario or stabilize `telepipe-ready` so enemies cannot change HP during the preservation probe.

2. The browser proof does not exercise the ICE level required by the ticket; the captured scenario is generic `telepipe-ready` on `training_caverns`, not `frost_crossing`.
   Files: game/server/debugScenarios.js, game/server/progression.js, game/validation/ice/findings.md
   Fix: Add/use a `frost_crossing` telepipe-ready validation path that selects the ice quest, injects Telepipe, and records findings from that same live path.

3. The capture asserts a fresh run id after redeploy without abandoning the suspended telepipe checkpoint, which conflicts with design: normal telepipe redeploy resumes the same run id.
   Files: game/server/debugScenarios.js, game/server/progression.js
   Fix: Either validate normal resume semantics with same runId, or explicitly abandon the suspended run before redeploying and then assert a new run id with HP/MS carry-forward.
