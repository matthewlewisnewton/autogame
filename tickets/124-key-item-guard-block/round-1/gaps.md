1. Guard Block's protected arc and shield VFX use the wrong facing-axis convention, so normal gameplay facing can fail to block frontal hits and can draw the shield off-axis.
   Files: `game/server/simulation.js`, `game/server/index.js`, `game/client/renderer.js`, `game/server/test/guard_block.test.js`, `game/server/test/server.test.js`
   Fix: align guard block with the existing `rotation = atan2(z, x)` convention: use `atan2(dz, dx)` for attacker angle, compare against `blockingYaw`, place the shield with `cos(yaw), sin(yaw)`, and update tests so yaw 0 protects +X.
