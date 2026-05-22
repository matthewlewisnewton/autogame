# Cleanup harness-owned port cleanup

> **Staleness note.** This follow-up ticket was written against commit
> `cbf7fe6` (2026-05-22). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

The harness currently frees dev-server ports by killing anything bound to ports 5173 and 3000 before each capture. That keeps the loop moving, but it is broad enough to kill unrelated local work if the same machine is being used interactively. Tighten the cleanup so it prefers harness-owned processes and only uses broad cleanup when explicitly justified.

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `cbf7fe6`; verify them against the current code before editing.

- `harness/lib.sh` `wait_port_free()` calls `fuser -k -9 "$port"/tcp` on every poll while a port remains bound.
- `harness/lib.sh` `start_game()` immediately calls `fuser -k -9 5173/tcp` and `fuser -k -9 3000/tcp` before launching the harness-managed server and Vite client.
- `harness/lib.sh` `start_game()` also retries Vite startup by killing whatever owns port 5173 after an `EADDRINUSE` log.

## Acceptance Criteria

- Normal harness-started game processes are still cleaned up reliably between capture attempts.
- Unrelated processes on ports 3000 or 5173 are not killed by default unless the harness can identify them as safe to stop or an explicit override is enabled.
- Port-conflict failures produce clear logs that tell the operator what is blocking progress.

## Technical Specs

- Likely files: `harness/lib.sh` and any docs/comments for harness runtime overrides.
- Consider tracking PIDs created by `start_game()`, checking command lines before killing by port, and adding an opt-in environment variable for the current broad cleanup behavior.
- Keep the existing protections against accidentally killing qwen or agent processes by prompt text.

## Verification: code
