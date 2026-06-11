# Cleanup nits from 353-anim-legion-marshal

> **Staleness note.** This follow-up ticket was written against commit
> `64373427` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `353-anim-legion-marshal`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Factor out shared "rising column" VFX helper
`spawnLegionMarshalRallyEffect` and `spawnEtherSiphonEffect` (and their
`isLegionMarshalColumn` / `isEtherSiphonColumn` update branches) duplicate the
same rising-column-with-flicker-and-fade pattern with only constants differing.
A shared helper would reduce drift as more per-card columns are added. Purely a
cleanup — current code is correct and tested.

### Acceptance Criteria
- A single reusable column primitive/update branch backs both Legion Marshal and
  Ether Siphon columns (and any future ascending-column VFX).
- Existing `vfx-primitives.test.js` and `cardRenderers.test.js` assertions still
  pass unchanged in behavior.
