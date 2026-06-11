## Simplify the ice stage-boss-gap branch in findings.mjs

`renderStageBossGapSection` in `harness/validate/lib/findings.mjs` now has two branches that emit the identical "Stage-boss encounter flow applies to Frost Crossing tier 1 (Permafrost Warden)." line: the `objectiveType === 'stage_boss'` branch and the `hasBossEncounterProbes` sub-branch of the non-stage_boss case. Additionally, `renderFindings` now skips `renderStageBossGapSection` entirely when `objectiveType === 'stage_boss'`, so the first branch's stage-boss message is effectively dead for the ice preset. This is harmless but slightly confusing to read.

### Acceptance Criteria
- The duplicated "Stage-boss encounter flow applies..." message and any now-unreachable branch in `renderStageBossGapSection` are consolidated so each rendered case has a single clear source.
- Existing findings.mjs unit tests still pass.
