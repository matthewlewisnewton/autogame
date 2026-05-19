# Combat Feedback and Readability

Make existing combat easier to understand by adding clear visual feedback for hits, damage, card usage, minions, and loot pickup. This ticket should not change enemy AI behavior or add attack telegraphs; those are handled by `030-encounter-telegraphs-audio` and `024-entity-ai-improvements`.

## Goal

Players should be able to tell what happened during combat without reading logs: which card fired, which enemies were hit, when players take damage, when minions attack, and when loot is collected.

## Acceptance Criteria
- Enemies show visible damage feedback when hit.
- Enemy damage feedback includes at least one of:
  - a brief red/white flash
  - a floating damage number
  - a short hit pulse or scale animation
- Enemies show health state clearly enough for QA screenshots, either with a simple health bar or color/intensity change.
- The local player shows visible feedback when damaged.
- Remote players show visible feedback when damaged or dead.
- Weapon card attacks already have an effect; improve it enough that the direction and hit area are readable in screenshots.
- Summon AoE effects clearly show radius and impact moment.
- Minion attacks produce a visible effect when they damage an enemy.
- Loot pickup produces immediate client feedback when the server confirms collection.
- Card slots show resource/cooldown constraints more clearly:
  - cooldown state
  - insufficient Magic Stones state for summon cards
  - empty slot state
- `cardError` messages still appear, but common resource constraints should also be visible in the hand UI.
- Existing combat mechanics and damage numbers do not change unless required for event payloads.

## Implementation Notes
- Prefer client-side visual effects driven by server events and state updates.
- If a server event lacks needed data, add the smallest event payload field required.
- Suggested lightweight client helpers in `game/client/main.js`:
  - `spawnDamageNumber(position, amount, color)`
  - `flashMesh(mesh, color, durationMs)`
  - `spawnHitSpark(position)`
  - `updateEnemyHealthVisual(enemy, mesh)`
  - `markLootCollected(lootId)`
- Reuse the existing `activeEffects` pattern where possible.
- Do not add large art assets; use simple Three.js meshes, CSS, or text overlays.
- Do not add audio in this ticket.
- Do not change enemy pathing, spawn rates, or attack logic here.

## Files
- `game/client/main.js`
- `game/client/index.html`
- `game/client/style.css`
- `game/server/index.js`
- `game/client/test/main.test.js`
- `game/server/test/integration.test.js`

## Tests
- Integration test that weapon/summon/minion damage events include enough data for client feedback.
- Client test for card slot classes or rendering states if existing test setup supports it.
- Client test for damage/health helper behavior if extracted into pure helpers.
- Existing combat integration tests must continue to pass.

## Visual QA Checklist
- Start a run with at least one enemy visible.
- Use a weapon card and verify the attack direction and hit feedback are visible.
- Use a summon card and verify the AoE radius/impact is visible.
- Spawn a minion and verify minion damage is visible.
- Pick up loot and verify immediate pickup feedback plus currency HUD update.
- Damage or kill a player and verify player feedback/death state is readable.

## Verification: visual
