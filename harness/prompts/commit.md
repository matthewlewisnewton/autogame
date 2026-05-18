You are committing a completed, QA-passed change in an autonomous
game-development harness. Committing the work is the ONLY task — do not
implement anything, do not change game code.

CONTEXT — the sub-ticket that was just implemented and passed QA:
@__TICKET_FILE__

STEPS:
1. Run `git status` and `git diff --stat` to see exactly what changed.
2. Stage the files that belong to this sub-ticket: the game source under
   `game/`, and this sub-ticket's own `ticket.md` if it is new/untracked.
3. Do NOT stage run artifacts or temp files — logs, screenshots,
   `*_iter*.txt`, `feedback.md`, `handoff.md`, `changes.diff`,
   `decompose-*.txt`. They are gitignored already; just confirm nothing stray
   gets added.
4. Make exactly ONE commit with a clear, meaningful message: a concise subject
   line describing WHAT changed and why, prefixed with `__LABEL__: `, plus a
   short body if it adds clarity.
5. Do NOT push, do NOT amend or rebase, do NOT touch any earlier commit.

Print the resulting commit hash and subject line.
