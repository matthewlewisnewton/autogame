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

    p_worker = sub.add_parser("worker", help="Run one ticket as a parallel-factory "
                              "worker in the current worktree, with a forced implementer agent")
    p_worker.add_argument("name", help="Ticket directory name under tickets/")
    p_worker.add_argument("--agent", required=True,
                          help="Agent name (from roles.yaml) to force as the implementer primary")

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
    if args.cmd == "worker":
        return _cmd_worker(args.name, args.agent)
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


def _write_implementer_override(root: Path, agent: str) -> None:
    """Force the implementer role's primary to `agent` via roles.local.yaml
    (field-level merged onto roles.yaml — overrides only implementer.primary).
    roles.local.yaml is gitignored, so this never dirties the worktree."""
    import yaml
    local = Path(root) / "harness" / "roles.local.yaml"
    data: dict = {}
    if local.exists():
        try:
            data = yaml.safe_load(local.read_text()) or {}
        except yaml.YAMLError:
            data = {}
    data.setdefault("roles", {}).setdefault("implementer", {})["primary"] = agent
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_text(yaml.safe_dump(data, sort_keys=False))


def _cmd_worker(name: str, agent: str) -> int:
    """Run one ticket as a parallel-factory worker in the CURRENT worktree, with
    `agent` forced as the implementer. cwd is the worktree; ports come from
    HARNESS_GAME_PORT/HARNESS_VITE_PORT (read by Repo.ports); telemetry goes to
    the shared HARNESS_PROGRESS_DIR. Does NOT start the progress server (the
    dispatcher owns the single one). Returns ticket()'s PipelineResult as the
    exit code so the dispatcher can interpret the outcome."""
    from harness.pipelines.ticket import TicketContext, ticket
    from harness.telemetry.progress import emit_progress_event
    _write_implementer_override(Path.cwd(), agent)
    workspace = _build_workspace()
    roster = _build_roster()
    tdir = Path(workspace.root) / "tickets" / name
    emit_progress_event("worker_start", {
        "ticket": name, "agent": agent,
        "game_port": workspace.ports.game_server, "vite_port": workspace.ports.vite,
        "worktree": str(workspace.root),
    })
    rc = ticket(TicketContext(
        workspace=workspace, roster=roster, name=name, tdir=tdir,
        tunables=roster.tunables,
    ))
    emit_progress_event("worker_done",
                        {"ticket": name, "agent": agent, "result": int(rc)})
    return int(rc)


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
