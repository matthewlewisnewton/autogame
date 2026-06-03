"""Subcommand router for `python -m harness`.

Phase 4 wires every subcommand body to its pipeline + ensures the
progress server is started for any event-emitting subcommand per
design doc §9.3.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional


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

    p_factory = sub.add_parser("factory", help="Run the parallel dispatcher (gastown factory)")
    p_factory.add_argument("--workers", type=int, default=None,
                           help="Concurrent worktree slots / port pairs "
                                "(default: from harness/factory.yaml)")
    p_factory.add_argument("--enable", metavar="AGENT",
                           help="Re-enable a circuit-broken agent and exit")
    p_factory.add_argument("--max-idle-ticks", type=int, default=0,
                           help="Stop after N consecutive idle ticks (0 = run forever)")

    p_prog = sub.add_parser("progress", help="Manage the events.ndjson HTTP server")
    p_prog.add_argument("action", choices=["start", "stop", "status"])

    p_lock = sub.add_parser("lock", help="Hold a shared-resource flock (e.g. blender) "
                            "until interrupted — serializes the operator session against "
                            "factory workers that touch the same resource")
    p_lock.add_argument("resource", help="Resource name, e.g. 'blender'")
    p_lock.add_argument("--timeout", type=float, default=None,
                        help="Give up waiting after N seconds (default: wait forever)")

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
    if args.cmd == "factory":
        return _cmd_factory(args.workers, args.enable, args.max_idle_ticks)
    if args.cmd == "progress":
        return _cmd_progress(args.action)
    if args.cmd == "lock":
        return _cmd_lock(args.resource, args.timeout)
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


def _cmd_factory(workers: int, enable: Optional[str], max_idle_ticks: int) -> int:
    if enable:
        from harness.dispatch.factory import default_registry
        reg = default_registry(Path.cwd() / "harness" / "agents_health.json")
        reg.enable(enable)
        print(f"[factory] re-enabled agent: {enable}")
        return 0
    from harness.dispatch.factory import run_factory
    return run_factory(str(Path.cwd()), workers=workers, max_idle_ticks=max_idle_ticks)


_WORKER_OVERRIDE_ROLES = ("implementer", "decomposer", "qa:code", "qa:visual")


def _write_worker_role_overrides(root: Path, agent: str) -> None:
    """Force the worker's whole per-ticket authoring pipeline onto `agent` via
    roles.local.yaml (field-level merged onto roles.yaml): planning (decomposer),
    implementation (implementer), AND sub-ticket review (qa:code / qa:visual).
    None of these may fall back to the shared qwen primary — that serializes
    every worker on the single ollama box and divorces a ticket's planning/review
    from the agent doing the work. Only `primary` is overridden, so each role's
    fallbacks (and the read-only deny scope on qa:*) are preserved. roles.local.yaml
    is gitignored, so this never dirties the worktree."""
    import yaml
    local = Path(root) / "harness" / "roles.local.yaml"
    data: dict = {}
    if local.exists():
        try:
            data = yaml.safe_load(local.read_text()) or {}
        except yaml.YAMLError:
            data = {}
    roles = data.setdefault("roles", {})
    for role_name in _WORKER_OVERRIDE_ROLES:
        roles.setdefault(role_name, {})["primary"] = agent
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_text(yaml.safe_dump(data, sort_keys=False))


def _cmd_worker(name: str, agent: str) -> int:
    """Run one ticket as a parallel-factory worker in the CURRENT worktree, with
    `agent` forced as the implementer. cwd is the worktree; ports come from
    HARNESS_GAME_PORT/HARNESS_VITE_PORT (read by Repo.ports); telemetry goes to
    the shared HARNESS_PROGRESS_DIR. Does NOT start the progress server (the
    dispatcher owns the single one). Returns ticket()'s PipelineResult as the
    exit code so the dispatcher can interpret the outcome."""
    from harness.dispatch.worktree_setup import install_deps, install_harness_deps, link_harness_deps
    from harness.pipelines.ticket import TicketContext, ticket
    from harness.pipelines.result import PipelineResult
    from harness.telemetry.progress import emit_progress_event
    _write_worker_role_overrides(Path.cwd(), agent)
    workspace = _build_workspace()
    roster = _build_roster()
    tdir = Path(workspace.root) / "tickets" / name
    emit_progress_event("worker_start", {
        "ticket": name, "agent": agent,
        "game_port": workspace.ports.game_server, "vite_port": workspace.ports.vite,
        "worktree": str(workspace.root),
    })
    # Fresh worktree has no node_modules — install before the pipeline runs the
    # game. A failure here is infra, not the agent's fault: return ESCALATE so
    # the dispatcher requeues without tripping the agent circuit-breaker.
    if not install_deps(workspace.root):
        emit_progress_event("worker_setup_failed", {"ticket": name, "agent": agent})
        return int(PipelineResult.ESCALATE)
    if not install_harness_deps(workspace.root):
        emit_progress_event("worker_setup_failed", {"ticket": name, "agent": agent})
        return int(PipelineResult.ESCALATE)
    # The worktree has harness SOURCE but no harness/node_modules — without this
    # `node harness/screenshot.mjs` can't import playwright and every capture
    # (hence every top-level review's runtime gate) fails. Link to main when
    # healthy; otherwise install locally in harness/.
    if not link_harness_deps(workspace.root):
        emit_progress_event("worker_setup_failed", {"ticket": name, "agent": agent, "reason": "harness_deps"})
        return int(PipelineResult.ESCALATE)

    def _run():
        return ticket(TicketContext(
            workspace=workspace, roster=roster, name=name, tdir=tdir,
            tunables=roster.tunables,
        ))

    # If this ticket declares a shared synchronous resource (e.g. `Resource: blender`
    # in ticket.md), hold the cross-process flock for the whole run so two workers
    # — or a worker and the operator session — never drive the single resource at
    # once. install/link above are deliberately OUTSIDE the lock (they don't need
    # the resource and shouldn't hold it during a slow pnpm install).
    from harness.concurrency.resource_lock import resource_for_ticket, held
    resource = resource_for_ticket(tdir)
    if resource:
        import os
        timeout = float(os.environ.get("HARNESS_RESOURCE_LOCK_TIMEOUT", "1800"))
        emit_progress_event("resource_wait", {"ticket": name, "resource": resource})
        try:
            with held(resource, timeout=timeout):
                emit_progress_event("resource_acquired", {"ticket": name, "resource": resource})
                rc = _run()
        except TimeoutError:
            # Resource stayed busy past the timeout — not the agent's fault; let the
            # dispatcher requeue the slot rather than block it forever.
            emit_progress_event("resource_timeout", {"ticket": name, "resource": resource})
            return int(PipelineResult.ESCALATE)
    else:
        rc = _run()
    emit_progress_event("worker_done",
                        {"ticket": name, "agent": agent, "result": int(rc)})
    return int(rc)


def _cmd_lock(resource: str, timeout: Optional[float]) -> int:
    """Hold a shared-resource flock until interrupted. Run in the background while
    hand-driving the resource (e.g. Blender) so factory workers that need the same
    resource wait instead of colliding; kill this process to release."""
    import os
    import signal
    from harness.concurrency.resource_lock import held
    try:
        with held(resource, timeout=timeout):
            print(f"[lock] holding '{resource}' (PID {os.getpid()}). "
                  f"Ctrl-C or `kill {os.getpid()}` to release.", flush=True)
            signal.pause()  # block until a signal; flock releases on exit
    except TimeoutError as e:
        print(f"[lock] {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        pass
    return 0


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
