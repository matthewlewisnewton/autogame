## Rename Telepipe Smoke Artifacts
The browser smoke script now validates hub return plus fresh redeploy with preserved vitals, but its filename/output path still use `telepipe-suspend-resume`. The behavior has moved away from checkpoint suspend/resume, so stale artifact names make future QA evidence harder to interpret.

### Acceptance Criteria
- Rename or alias the smoke script/output directory/docs references so they describe Telepipe hub return and fresh redeploy instead of suspend/resume.
