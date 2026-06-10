## Avoid Persistent Progress Mutation In Citadel Debug Scenario

The `citadel-siege-boss` debug scenario calls `completeQuestTier()` for its three prerequisites, which can permanently advance the QA account used for the shortcut. This is debug-only and does not affect normal gameplay, but a transient unlock/setup path would keep captures cleaner.

### Acceptance Criteria
- Running `?debugScenario=citadel-siege-boss` reaches the same capstone debug state without permanently recording prerequisite quest completions on the account.
