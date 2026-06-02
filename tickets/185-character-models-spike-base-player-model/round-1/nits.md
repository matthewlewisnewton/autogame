## Reconcile SPIKE_DECISION "final choice" with the actually-committed mesh

`game/docs/SPIKE_DECISION.md` names **Regular Male** as the concrete mesh in its
"Final choice" section, but the asset actually committed (and credited in
`CREDITS.md` / `README.md`) is **Superhero Male**, because Regular Male only
ships in Quaternius's paid Source tier. The two correct docs already note this;
only SPIKE_DECISION is out of sync, which could mislead a later asset swap.

### Acceptance Criteria
- `SPIKE_DECISION.md` states that the spike ships **Superhero Male** (free
  Standard tier) and that **Regular Male** is the intended swap once the paid
  Source asset is available, matching `README.md` and `CREDITS.md`.

## Add a normalization assertion to the morph test

`game/client/test/playerModelMorphs.test.js` verifies morph names but not the
sub-ticket-02 normalization the contract depends on (feet y≈0, height ≈1.8).
A cheap bounding-box assertion would lock the normalization against future
re-exports regressing it.

### Acceptance Criteria
- The test (or a sibling) reads `player.glb` POSITION accessor min/max and
  asserts overall height ≈ 1.8 (within tolerance) and minimum Y ≈ 0.
