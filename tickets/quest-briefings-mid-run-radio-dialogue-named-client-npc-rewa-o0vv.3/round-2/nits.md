## Wire Tier-2 Support Radio Beats
Some tier-2 stage-boss quest definitions include `{ waveCleared }` dialogue for support-count progress, while the current `waveCleared` emission path is only wired for survive objectives. This is outside the current tier-1 acceptance path, but those authored tier-2 lines should either use a supported trigger or get a stage-boss support-defeat hook before future QA relies on them.

### Acceptance Criteria
- Tier-2 stage-boss support-count dialogue fires from server-side progression when the configured support threshold is reached, or the quest content is changed to use only currently supported triggers.
