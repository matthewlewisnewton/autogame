"""Factory launcher — assembles and runs the parallel dispatcher.

Wires BeadsQueue + AgentRegistry + Dispatcher + MergeQueue into one process
(the sole beads writer, worktree creator, and merge author), reconciles state
orphaned by a previous crash, and runs the loop. Default lane config encodes the
agreed routing: qwen=easy (cap 1, single ollama box), composer-2.5=medium
(cap 3), gpt-5.5-extra=hard (cap 3), with overflow via preference order.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from harness.beads import BeadsQueue
from harness.dispatch.dispatcher import Dispatcher
from harness.dispatch.merge_queue import MergeQueue
from harness.dispatch.registry import AgentRegistry, AgentSpec
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.ports import allocate_pool
from harness.workspace.repo import Repo

DEFAULT_SPECS = [
    AgentSpec("qwen", max_concurrency=1, eligible=frozenset({"easy", "medium"})),
    AgentSpec("composer_write", max_concurrency=3,
              eligible=frozenset({"easy", "medium", "hard"})),
    AgentSpec("gpt5_extra_write", max_concurrency=3, eligible=frozenset({"hard"})),
]
DEFAULT_PREFERENCE = {
    "easy":   ["qwen", "composer_write"],
    "medium": ["composer_write", "qwen"],       # composer primary; qwen overflow
    "hard":   ["gpt5_extra_write", "composer_write"],
}


def default_registry(health_file: Path) -> AgentRegistry:
    return AgentRegistry(DEFAULT_SPECS, DEFAULT_PREFERENCE, health_file=health_file)


def reconcile(queue: BeadsQueue, main_repo: Repo) -> int:
    """On startup no workers are running, so any `in_progress` bead is orphaned
    from a previous run — reset it to ready. Also prune stale git worktrees.
    Returns the number of orphans reset."""
    try:
        orphans = queue.in_progress()
    except Exception as e:
        log(f"[factory] reconcile: could not list in_progress beads: {e!r}")
        orphans = []
    for issue in orphans:
        log(f"[factory] reconcile: resetting orphaned in_progress {issue.get('title', issue.get('id'))}")
        try:
            queue.requeue(issue["id"], note="reconcile: orphaned in_progress on dispatcher startup")
        except Exception as e:
            log(f"[factory] reconcile: requeue failed for {issue.get('id')}: {e!r}")
    try:
        main_repo.run_git("worktree", "prune", check=False, capture=False)
    except Exception:
        pass
    return len(orphans)


def build_factory(main_root, *, workers: int = 3,
                  health_file: Optional[Path] = None, tick_seconds: float = 5.0):
    main_root = Path(main_root)
    main_repo = Repo(root=main_root)
    queue = BeadsQueue(main_root)
    registry = default_registry(health_file or main_root / "harness" / "agents_health.json")
    mq = MergeQueue(main_repo=main_repo, queue=queue)
    disp = Dispatcher(
        queue=queue, registry=registry, main_repo=main_repo,
        ports_pool=allocate_pool(workers),
        on_pass=mq.enqueue, merge_drain=mq.drain_one,
        tick_seconds=tick_seconds,
    )
    return disp, mq, queue, registry


def run_factory(main_root, *, workers: int = 3, max_idle_ticks: int = 0,
                **kw) -> int:
    from harness.telemetry import progress_server
    disp, mq, queue, registry = build_factory(main_root, workers=workers, **kw)
    n = reconcile(queue, disp.main_repo)
    log(f"[factory] reconciled {n} orphaned ticket(s); launching {workers} workers")
    disabled = registry.disabled_agents()
    if disabled:
        log(f"[factory] NOTE: agents disabled (need `harness factory --enable <agent>`): {disabled}")
    progress_server.start_if_needed()
    emit_progress_event("factory_start", {"workers": workers, "disabled_agents": disabled})
    disp.run(max_idle_ticks=max_idle_ticks)
    return 0


__all__ = ["run_factory", "build_factory", "reconcile", "default_registry",
           "DEFAULT_SPECS", "DEFAULT_PREFERENCE"]
