## Generalize the `suppressWavesAfterDeploy` comment

The inline comment on the `suppressWavesAfterDeploy` branch in `game/server/progression.js` (~L3979) is frost-specific ("entering the ice band does not spawn Frostmaw and fail the run mid-suspend"), but the hook is now shared by both `frost-crossing-telepipe-ready` and `fire-telepipe-ready`. The comment should describe the generic harness-walk isolation purpose so it isn't misleading for the fire path.

### Acceptance Criteria
- The comment on the `suppressWavesAfterDeploy` branch describes the general purpose (isolate the harness suspend-walk from live waves for any telepipe-ready scenario) without implying it is frost-only.
