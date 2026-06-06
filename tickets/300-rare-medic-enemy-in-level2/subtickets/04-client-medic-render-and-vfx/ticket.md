# Client Field Medic mesh, heal pulse, and energy bead VFX

Give `field_medic` a distinct procedural mesh and wire server-emitted heal/bead events into client VFX. Lock-on info panel support is automatic once sub-ticket 01 landed in the display catalog — verify it shows name, stats, and description when locking on a medic.

## Acceptance Criteria

- `createEnemyMesh('field_medic')` returns a distinct mesh (not the grunt fallback): e.g. small green/teal octahedron or sphere with emissive tint, registered in `ENEMY_GEOMETRY` and `ENEMY_ATTACK_VISUAL` (projectile/bead style).
- `enemyMeshHalfHeight('field_medic')` and `getRegistryTargetFootprint('field_medic')` resolve correctly.
- When the server emits medic ally-heal events (from sub-ticket 03), the client plays a heal pulse at the medic/target position (reuse or wrap `triggerHealPulseVFX` with medic-appropriate radius).
- When the server emits medic energy-bead events, the client renders a small luminous projectile/beam along the attack vector (reuse phase-beam / projectile renderer patterns from `cardRenderers` / `renderer.js` minion breath handling).
- Lock-on panel: with a living `field_medic` targeted, `buildLockOnPanelModel` shows the medic `name`, HP line, surfaced stats, and `description` from the catalog.
- Client tests cover mesh creation, half-height, and panel model for `field_medic`.
- Vitest passes.

## Technical Specs

- `game/client/renderer.js`:
  - Add `field_medic` entries to `ENEMY_GEOMETRY` and `ENEMY_ATTACK_VISUAL`.
  - Export helpers for medic heal pulse and energy bead VFX (or extend existing projectile render path).
  - Subscribe to new socket events in the render/sync layer (or handle via existing state-update pending queues if the server mirrors minion-breath delivery).
- `game/client/main.js`:
  - Wire socket listeners for medic heal/bead events to renderer VFX functions (mirror `keyItemHealPulse` → `triggerHealPulseVFX` pattern ~L1567).
- `game/shared/events.json` (only if sub-ticket 03 introduced new event names): add constants for medic heal/bead client events.
- `game/client/test/main.test.js`:
  - Extend `createEnemyMesh()` describe block with `field_medic` mesh assertions.
- `game/client/test/lock-on-info-panel.test.js`:
  - Add case building a panel model for `type: 'field_medic'` using catalog fixture.
- `game/client/test/renderer-registry-normalize.test.js`:
  - Add `field_medic` footprint/half-height expectations if that file lists all enemy types.
- Optional: `game/client/test/cardRenderers.test.js`-style test for bead corridor rendering if a dedicated helper is added.

## Verification: code
