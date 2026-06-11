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
