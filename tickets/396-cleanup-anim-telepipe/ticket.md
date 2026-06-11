# Cleanup nits from 364-anim-telepipe

> **Staleness note.** This follow-up ticket was written against commit
> `f1911ab9` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `364-anim-telepipe`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
