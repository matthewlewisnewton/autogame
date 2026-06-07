## Refresh Legacy Telepipe Smoke-Test Wording

`game/client/scripts/test-telepipe-suspend-resume.mjs` still describes solo Telepipe extraction as returning to the hub with no checkpoint and redeploying into a fresh dungeon. That wording is stale under the new resume/checkpoint policy and can mislead future QA work.

### Acceptance Criteria
- The script header and any related generated walkthrough text describe the current telepipe suspend/resume behavior accurately.
