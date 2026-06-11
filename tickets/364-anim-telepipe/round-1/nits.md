## Telepipe cast spawns a redundant second particle burst

`renderTelepipe` (game/client/cardRenderers.js) calls `spawnTelepipeCastEffect`,
which already emits its own upward particle burst, and then calls
`ctx.spawnParticleBurst` again at the same origin — so two near-identical bursts
fire on every cast. It is harmless (both clean up) and visually fine, but it is
duplicated work and makes the VFX layering harder to reason about. Consider
folding the extra burst into the primitive or dropping the redundant call.

### Acceptance Criteria
- A single Telepipe cast spawns exactly one particle burst (either from the
  primitive or from `renderTelepipe`, not both), with no visible loss of effect.
- Existing telepipe renderer/primitive tests still pass.
