"""Subcommand router for `python -m harness`.

Phase 1: every subcommand is a stub that prints "not implemented" and exits
non-zero. Subcommand handlers are wired in their respective phase per the
design doc §12 migration plan:

  - supervisor / backlog / ticket / subtask → Phase 4 (pipelines)
  - progress {start,stop,status} → Phase 4 (telemetry/progress_server)
  - doctor vision → Phase 4 (ports qwen_vision_smoke.sh)

The router itself is real Python in Phase 1 so the CLI surface is stable
from PR #1 onward.
"""

from __future__ import annotations

import argparse
import sys


def _not_implemented(name: str) -> int:
    print(f"[{name}] not implemented in Phase 1 — see harness/docs/python-rewrite.md §12 for the schedule.",
          file=sys.stderr)
    return 64  # EX_USAGE-ish; non-zero so CI catches stray invocations


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="harness",
        description="Autogame Python harness — replaces harness/*.sh. "
                    "See harness/docs/python-rewrite.md for the design.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # Top-level loop subcommands (Phase 4 wires the bodies)
    sub.add_parser("supervisor", help="Outermost watchdog loop (replaces supervisor.sh)")
    sub.add_parser("backlog",    help="Walk open tickets (replaces run_backlog.sh)")
    p_ticket = sub.add_parser("ticket",   help="Run one ticket (replaces run_ticket.sh)")
    p_ticket.add_argument("name", help="Ticket directory name under tickets/")
    p_subtask = sub.add_parser("subtask",  help="Run one sub-ticket (replaces run_subtask.sh)")
    p_subtask.add_argument("subdir", help="Sub-ticket directory path")

    # Progress server lifecycle (§9.3)
    p_prog = sub.add_parser("progress", help="Manage the events.ndjson HTTP server")
    p_prog.add_argument("action", choices=["start", "stop", "status"])

    # Diagnostic / smoke subcommands
    p_doc = sub.add_parser("doctor", help="Diagnostic smoke checks")
    p_doc.add_argument("target", choices=["vision"], help="What to smoke-check")

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    return _not_implemented(args.cmd)


if __name__ == "__main__":
    raise SystemExit(main())
