"""Factory launcher — assembles and runs the parallel dispatcher.

Wires BeadsQueue + AgentRegistry + Dispatcher + MergeQueue into one process
(the sole beads writer, worktree creator, and merge author), reconciles state
orphaned by a previous crash, and runs the loop. Default lane config encodes the
agreed routing: qwen=easy (cap 1, single ollama box), composer-2.5=medium
(cap 3), gpt-5.5-extra=hard (cap 3), with overflow via preference order.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional

from harness.beads import BeadsQueue
from harness.dispatch.dispatcher import Dispatcher
from harness.dispatch.merge_queue import MERGED_UNCLOSED, MergeQueue
from harness.dispatch.registry import AgentRegistry, AgentSpec
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.ports import allocate_pool
from harness.workspace.repo import Repo

DEFAULT_SPECS = [
    AgentSpec("qwen", max_concurrency=1, eligible=frozenset({"easy", "medium"})),
    AgentSpec("composer_write", max_concurrency=3,
              eligible=frozenset({"easy", "medium", "hard"})),
    AgentSpec("gpt5_extra_write", max_concurrency=1, eligible=frozenset({"hard"})),
    # claude opted in for medium/hard only, single-concurrency (cost-bounded).
    AgentSpec("claude", max_concurrency=1, eligible=frozenset({"medium", "hard"})),
]
DEFAULT_PREFERENCE = {
    "easy":   ["qwen", "composer_write"],
    # claude (cap 1) is a first-class candidate for BOTH medium and hard — medium
    # primary, and hard runner-up behind the gpt-5.5 hard specialist. As pure
    # overflow it never ran (the other caps already cover the slots). With the
    # hard lane processed first, claude picks up a hard ticket when 2+ are ready
    # and falls back to medium otherwise.
    "medium": ["claude", "composer_write", "qwen"],
    "hard":   ["gpt5_extra_write", "claude", "composer_write"],
}


def default_registry(health_file: Path) -> AgentRegistry:
    return AgentRegistry(DEFAULT_SPECS, DEFAULT_PREFERENCE, health_file=health_file)


def _kill_stray_workers() -> None:
    """A crashed dispatcher leaves its `harness worker` subprocesses alive
    (they're spawned with start_new_session=True). Kill them BEFORE requeuing
    their beads, or a survivor + the new claimant would double-run the ticket in
    the same branch/worktree. Best-effort; no live dispatcher names its own
    process `harness worker` (it's `harness factory`), so this won't self-kill."""
    try:
        subprocess.run(["pkill", "-f", "harness worker"], check=False,
                       capture_output=True)
    except Exception as e:
        log(f"[factory] reconcile: pkill stray workers failed: {e!r}")


def _read_merged_unclosed(root: Path) -> set[str]:
    try:
        text = (Path(root) / MERGED_UNCLOSED).read_text()
    except OSError:
        return set()
    return {ln.strip() for ln in text.splitlines() if ln.strip()}


def reconcile(queue: BeadsQueue, main_repo: Repo) -> int:
    """On startup no workers should be running, so any `in_progress` bead is
    orphaned from a previous run. Reset it to ready — EXCEPT beads recorded as
    merged-but-unclosed (already on main): those get closed, not re-run. Also
    kills stray detached workers first and prunes stale worktrees. Returns the
    number of orphans reset to ready."""
    _kill_stray_workers()
    merged_unclosed = _read_merged_unclosed(main_repo.root)
    try:
        orphans = queue.in_progress()
    except Exception as e:
        log(f"[factory] reconcile: could not list in_progress beads: {e!r}")
        orphans = []
    reset = 0
    for issue in orphans:
        iid = issue["id"]
        label = issue.get("title", iid)
        if iid in merged_unclosed:
            log(f"[factory] reconcile: {label} was merged but unclosed — closing")
            try:
                queue.close(iid, "merged to main (recovered by reconcile)")
            except Exception as e:
                log(f"[factory] reconcile: close of merged {iid} failed: {e!r}")
            continue
        log(f"[factory] reconcile: resetting orphaned in_progress {label}")
        try:
            queue.requeue(iid, note="reconcile: orphaned in_progress on dispatcher startup")
            reset += 1
        except Exception as e:
            log(f"[factory] reconcile: requeue failed for {iid}: {e!r}")
    if merged_unclosed:
        try:
            (Path(main_repo.root) / MERGED_UNCLOSED).unlink()
        except OSError:
            pass
    try:
        main_repo.run_git("worktree", "prune", check=False, capture=False)
    except Exception:
        pass
    return reset


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
        reserve_qwen_easy=True,   # keep the local GPU box hot while easy work remains
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
