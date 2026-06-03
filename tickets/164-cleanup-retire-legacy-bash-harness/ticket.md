# 164-cleanup-retire-legacy-bash-harness

## Difficulty: hard

## Goal

~2368 lines of fully-ported bash (harness/lib.sh 1365, run_ticket.sh 516, run_subtask.sh 371, run_backlog.sh 50, supervisor.sh 66) are now dead: production is 'harness factory' (Python), nothing imports the bash, and the team has confirmed there will be NO rollback to bash. They are still being maintained in lockstep (commit 685d353 mirrored game-proc regex edits into lib.sh alongside steps/game.py), which is wasted double-maintenance. The bash remains recoverable from git history via tag bash-rollback-v1 if ever needed, so the working-tree copy is pure redundancy. ACTIONABLE: no sign-off blocker remains.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: code`
