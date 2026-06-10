1. `barrier_dome` still treats its radius as flat XZ, so elevated attackers/victims at the same XZ can be incorrectly considered inside the dome.
   Files: `game/server/keyItemEffects.js`, `game/server/simulation.js`, `game/server/test/barrier_dome.test.js`
   Fix: Store `barrierDomeY` on cast, use 3D distance for victim and attacker dome membership, and add vertical in-sphere/out-of-sphere tests.

2. `phase_step` still uses XZ-only distance for nearest-ally selection and the range gate.
   Files: `game/server/keyItemEffects.js`, `game/server/test/phase_step.test.js`
   Fix: Use 3D distance from the caster to candidate allies for selection/range validation and add tests for elevated allies inside and outside the sphere.

3. `loot_magnet` still uses XZ-only distance for `attractRadius` and final pickup radius.
   Files: `game/server/keyItemEffects.js`, `game/server/test/loot_magnet.test.js`
   Fix: Give loot a consistent world Y or floor-derived Y, use 3D distance for attraction and auto-collection, and add vertical exclusion tests.

4. The recorded coverage run fails `server/test/smoke_bomb.test.js > casting sets smokeBombUntil/radius/center and cooldown on the caster`.
   Files: `game/server/keyItemEffects.js`, `game/server/test/smoke_bomb.test.js`
   Fix: Preserve or correctly verify the smoke-bomb dirty/save contract so `persistenceDirtyOnCast` is true or the test asserts the actual save behavior, then rerun the vitest coverage suite.
