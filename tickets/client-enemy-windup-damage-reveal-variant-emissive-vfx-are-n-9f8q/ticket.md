# Client: enemy windup/damage/reveal/variant emissive VFX are no-ops on modeled enemies and self-cancelling on procedural ones

## Difficulty: medium

## Goal

Two compounding problems in game/client/renderer.js. (1) attachRegistryModel hides the procedural cone (node.material.visible=false, renderer.js:650) and only retargets userData.bodyMesh for the player (renderer.js:659), but applyWindupFlash, applyRevealHighlight, applyEnemyVariantTint, applyVariantEmissiveTint, and flashMesh(enemiesMeshes[id]) all write to the hidden procedural material (renderer.js:3234-3276, 3326-3337). grunt/skirmisher/miniboss/spawner all have .glb models, so windup telegraph, damage flash, Flare Beacon reveal glow, and warded/frenzied tints are invisible for the most common enemies. (2) In animate(), applyRevealHighlight (renderer.js:6593) runs unconditionally per frame and resets material.emissive to _origEmissive whenever the enemy is not revealed, wiping the windup flash and any active flashMesh damage flash the same frame. Fix: retarget enemy userData.bodyMesh to the loaded model mesh with a cloned material (mirror retargetPlayerBodyMesh), and replace the competing emissive writers with a single per-frame priority resolver (damage flash > windup > reveal > variant tint > base). Found in code review 2026-06-09.

## Acceptance Criteria

- Windup flash, damage flash, reveal glow and variant tints are visible on modeled (.glb) enemies; a windup flash is not cleared by the reveal-highlight pass; tests cover the priority resolver

## Verification

reconcile: orphaned in_progress on dispatcher startup
