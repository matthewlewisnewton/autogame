1. Solar Edge has distinct slash VFX but does not show the required 315 charge-up telegraph.
   Files: game/shared/cardStats.json, game/client/test/cardRenderers.test.js
   Fix: Give `flame_blade` / Solar Edge an appropriate `windUpMs` so the existing card wind-up indicator runs before impact, and add/update a test that includes `flame_blade` in the wind-up telegraph coverage.
