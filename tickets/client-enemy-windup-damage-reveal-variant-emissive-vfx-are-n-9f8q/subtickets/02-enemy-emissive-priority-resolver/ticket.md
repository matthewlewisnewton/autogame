# Enemy emissive priority resolver (damage > windup > reveal > variant > base)

Multiple per-frame emissive writers (`applyWindupFlash`, `applyRevealHighlight`, `applyVariantEmissiveTint`, and `flashMesh` timeouts) fight over the same material: `applyRevealHighlight` resets `_origEmissive` every frame when the enemy is not revealed, clearing active windup telegraph and in-flight damage flashes. Replace the competing direct writes with a single per-enemy resolver that picks the highest-priority active effect each frame.

## Acceptance Criteria

- One resolver runs per enemy each `syncEnemyMeshes` update and sets `bodyMesh.material.emissive` / `emissiveIntensity` from priority: **damage flash > windup > reveal > variant emissive tint > base** (`_origEmissive` / `_origEmissiveIntensity`).
- An enemy in windup with no reveal and no active damage flash shows windup emissive (`0xff3333`, intensity `1.5`) and that state survives the reveal-highlight pass on the same frame (windup is not cleared when `revealedUntil` is absent/expired).
- An active `flashMesh` on an enemy wins over windup, reveal, and variant tint for its duration; after the flash expires, the resolver restores the next-highest active effect (e.g. windup if still in `attackState === 'windup'`).
- Reveal glow (`revealedUntil` in the future) applies amber emissive when no higher-priority effect is active; leeching variant emissive tint applies only when reveal, windup, and damage flash are all inactive.
- `applyWindupFlash` / `applyRevealHighlight` / `applyVariantEmissiveTint` become state setters (or thin wrappers) that no longer unconditionally reset emissive; `windupFlashing` bookkeeping remains for idempotent windup entry.
- Vitest in `game/client/test/renderer-enemy-emissive-priority.test.js` (new) covers at least: windup survives non-reveal reveal pass, damage flash beats windup, reveal beats variant tint, and post-flash fallback to windup.

## Technical Specs

- **`game/client/renderer/enemySync.js`**
  - Add `resolveEnemyEmissive(enemyId, enemy)` (or equivalent) that reads active flags: `windupFlashing` / `enemy.attackState`, `enemy.revealedUntil`, `VARIANT_MESH_TINTS[enemy.variant]`, and a per-enemy damage-flash-until timestamp.
  - Call it once per enemy at the end of the emissive-related block in `syncEnemyMeshes`, replacing the direct emissive mutations currently spread across `applyWindupFlash`, `applyRevealHighlight`, and `applyVariantEmissiveTint`.
  - Refactor those three exports to update state only (windup set membership, reveal eligibility, variant tint selection) without writing `material.emissive` directly.
- **`game/client/renderer.js`**
  - Extend `flashMesh` (or add a sibling helper) so enemy flashes register an expiry on the host/`enemyId` map that the resolver consults; the timeout callback clears the flash slot and triggers a resolver pass instead of blindly restoring captured pre-flash emissive (which races with windup/reveal).
  - Export any flash-tracking map the tests need (mirror `windupFlashing` test hooks).
- **`game/client/test/renderer-enemy-emissive-priority.test.js`** (new)
  - Unit-test the resolver with mocked `enemiesMeshes` entries (body mesh + material), asserting emissive hex/intensity for combined windup + reveal-off + flash scenarios.
- **`game/client/test/main.test.js`**
  - Update existing `applyWindupFlash` / `applyRevealHighlight` / `flashMesh` interaction tests if they assumed the old direct-write behavior.

## Verification: code
