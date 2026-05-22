"""Subcommand router for `python -m harness`.

Phase 4 wires every subcommand body to its pipeline + ensures the
progress server is started for any event-emitting subcommand per
design doc §9.3.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="harness",
        description="Autogame Python harness — replaces harness/*.sh. "
                    "See harness/docs/python-rewrite.md for the design.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("supervisor", help="Outermost watchdog loop (replaces supervisor.sh)")
    sub.add_parser("backlog",    help="Walk open tickets (replaces run_backlog.sh)")
    p_ticket = sub.add_parser("ticket", help="Run one ticket (replaces run_ticket.sh)")
    p_ticket.add_argument("name", help="Ticket directory name under tickets/")
    p_subtask = sub.add_parser("subtask", help="Run one sub-ticket (replaces run_subtask.sh)")
    p_subtask.add_argument("subdir", help="Sub-ticket directory path")

    p_prog = sub.add_parser("progress", help="Manage the events.ndjson HTTP server")
    p_prog.add_argument("action", choices=["start", "stop", "status"])

    p_doc = sub.add_parser("doctor", help="Diagnostic smoke checks")
    p_doc.add_argument("target", choices=["vision"], help="What to smoke-check")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.cmd == "supervisor":
        return _cmd_supervisor()
    if args.cmd == "backlog":
        return _cmd_backlog()
    if args.cmd == "ticket":
        return _cmd_ticket(args.name)
    if args.cmd == "subtask":
        return _cmd_subtask(args.subdir)
    if args.cmd == "progress":
        return _cmd_progress(args.action)
    if args.cmd == "doctor":
        return _cmd_doctor(args.target)
    print(f"[cli] unknown subcommand: {args.cmd}", file=sys.stderr)
    return 64


def _build_workspace():
    from harness.workspace.repo import Repo
    return Repo(root=Path.cwd())


def _build_roster():
    from harness.roles import Roster
    base = Path("harness/roles.yaml")
    local = Path("harness/roles.local.yaml")
    return Roster.load(base, local if local.exists() else None)


def _cmd_supervisor() -> int:
    from harness.supervisor import Supervisor
    return Supervisor(workspace=_build_workspace()).run()


def _cmd_backlog() -> int:
    from harness.pipelines.backlog import BacklogContext, backlog
    from harness.telemetry import progress_server
    progress_server.start_if_needed()
    roster = _build_roster()
    return backlog(BacklogContext(
        workspace=_build_workspace(), roster=roster, tunables=roster.tunables,
    ))


def _cmd_ticket(name: str) -> int:
    from harness.pipelines.ticket import TicketContext, ticket
    from harness.telemetry import progress_server
    progress_server.start_if_needed()
    workspace = _build_workspace()
    roster = _build_roster()
    tdir = Path(workspace.root) / "tickets" / name
    return ticket(TicketContext(
        workspace=workspace, roster=roster, name=name, tdir=tdir,
        tunables=roster.tunables,
    ))


def _cmd_subtask(subdir_arg: str) -> int:
    from harness.pipelines.subtask import SubtaskContext, subtask
    from harness.telemetry import progress_server
    progress_server.start_if_needed()
    workspace = _build_workspace()
    roster = _build_roster()
    subdir = Path(subdir_arg).resolve()
    label = f"{subdir.parent.parent.name}/{subdir.name}"
    return subtask(SubtaskContext(
        workspace=workspace, roster=roster, subdir=subdir,
        label=label, tunables=roster.tunables,
    ))


def _cmd_progress(action: str) -> int:
    from harness.telemetry import progress_server
    if action == "start":
        progress_server.start_if_needed()
    elif action == "stop":
        progress_server.stop()
    s = progress_server.status()
    print(f"progress server: port={s.port} listening={s.listening} pid={s.pid}")
    return 0


def _cmd_doctor(target: str) -> int:
    if target == "vision":
        print("[doctor] vision smoke not yet wired in Phase 4 — see harness/qwen_vision_smoke.sh",
              file=sys.stderr)
        return 64
    return 64


if __name__ == "__main__":
    raise SystemExit(main())
