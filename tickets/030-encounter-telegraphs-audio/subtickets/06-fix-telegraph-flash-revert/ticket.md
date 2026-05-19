# Fix: Enemy Telegraph Flash Never Reverts

The enemy windup color flash stays permanently red after the first attack because `flashMesh()` is called every animation frame during the 800 ms windup. Each call captures the current (already-red) emissive as the "original" to restore to, so the final restore timer leaves the mesh red. Fix the telegraph block to set the warning color once on entering windup and restore the original color when leaving windup.

## Acceptance Criteria
- When an enemy enters `windup` state, its mesh emissive is set to the warning color (`0xff3333`) **exactly once** — not every frame.
- When an enemy leaves `windup` state (transitions to `recovering`, `chasing`, `idle`, or is removed), its mesh emissive is restored to the original color (`0x000000`) and original `emissiveIntensity` (`0`).
- After multiple windup cycles (windup → recover → windup again), the enemy correctly flashes red during windup and returns to normal color during non-windup states.
- Enemies that have never entered windup remain at their default emissive color.
- No per-frame `flashMesh()` calls occur during the windup duration.

## Technical Specs
- **File:** `game/client/main.js`
  - Remove the `flashMesh(enemiesMeshes[enemy.id], 0xff3333, 300)` call from inside the `if (enemy.attackState === 'windup')` block (~line 1642).
  - Add a `windupFlashing` Set (or similar tracking) to record which enemies currently have the windup emissive applied.
  - In the `if (enemy.attackState === 'windup')` branch, **if the enemy is not yet in `windupFlashing`**: directly set `mesh.material.emissive.set(0xff3333)` and `mesh.material.emissiveIntensity = 1.5`, then add the enemy id to `windupFlashing`. Do this only on first entry, not every frame.
  - In the `else` branch (enemy is no longer in windup), **if the enemy id is in `windupFlashing`**: restore `mesh.material.emissive.set(0x000000)` and `mesh.material.emissiveIntensity = 0`, then remove the enemy id from `windupFlashing`. This mirrors the create/teardown pattern already used for `telegraphMeshes`.
  - In the cleanup loop for removed enemies, also remove any entries from `windupFlashing` for deleted enemies.
  - Clean up `windupFlashing` entries in the run-reset block (where `telegraphMeshes` is already cleared).
- **File:** `game/client/test/main.test.js` — add a unit test that verifies: (a) entering windup sets emissive once, (b) leaving windup restores emissive, (c) multiple windup cycles correctly toggle.

## Verification: code
