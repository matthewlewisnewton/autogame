"""Dispatcher — the parallel factory's scheduler.

Ties the pieces together: pull ready work per difficulty lane from beads
(`BeadsQueue`), pick an eligible/under-cap/healthy agent (`AgentRegistry`),
atomically claim the ticket, and spawn the existing `ticket()` pipeline as a
WORKER SUBPROCESS (`harness worker`) in an isolated `WorktreeWorkspace` with
allocated ports. On worker completion: PASS → hand the branch to the merge
queue; a quota/unavailable failure → disable the agent (circuit breaker) and
requeue the ticket; any other failure → requeue.

The scheduling core (`tick`) and outcome handling are pure given injected I/O
(spawn fn, quota classifier, on-pass callback), so they unit-test with fakes.
`run()` is the thin polling loop around them. The dispatcher is the SOLE beads
writer and the SOLE creator of worktrees, so claims and worktree lifecycle are
single-threaded — no cross-process lock needed there.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from harness.beads import BeadsQueue
from harness.dispatch.registry import AgentRegistry
from harness.pipelines.result import PipelineResult
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event, progress_dir
from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo, WorktreeWorkspace


@dataclass
class WorkerHandle:
    ticket_id: str
    agent: str
    difficulty: str
    worktree: WorktreeWorkspace
    proc: object  # has .poll() -> Optional[int]

    def poll(self) -> Optional[int]:
        return self.proc.poll()


# spawn(ticket_id, agent, worktree, ports) -> a process handle with .poll()
SpawnFn = Callable[[str, str, WorktreeWorkspace, PortAllocation], object]
# quota_classifier(agent) -> True if the agent's recent calls show quota/unavailable
QuotaFn = Callable[[str], bool]
# on_pass(handle) -> enqueue the worker's branch for merge (merge queue owns teardown)
OnPassFn = Callable[[WorkerHandle], None]


def subprocess_spawn(ticket_id: str, agent: str, worktree: WorktreeWorkspace,
                     ports: PortAllocation) -> subprocess.Popen:
    """Launch `harness worker` in the worktree with ports + shared telemetry."""
    env = {
        **os.environ,
        "HARNESS_GAME_PORT": str(ports.game_server),
        "HARNESS_VITE_PORT": str(ports.vite),
        # Pin telemetry to the MAIN checkout's progress dir so the live view is unified.
        "HARNESS_PROGRESS_DIR": str(progress_dir()),
    }
    return subprocess.Popen(
        [sys.executable, "-m", "harness", "worker", ticket_id, "--agent", agent],
        cwd=str(worktree.root), env=env, start_new_session=True,
    )


@dataclass
class Dispatcher:
    queue: BeadsQueue
    registry: AgentRegistry
    main_repo: Repo
    ports_pool: list[PortAllocation]
    lanes: list[str] = field(default_factory=lambda: ["hard", "medium", "easy"])
    spawn: SpawnFn = subprocess_spawn
    quota_classifier: Optional[QuotaFn] = None
    on_pass: Optional[OnPassFn] = None
    worktree_factory: Optional[Callable[[str, PortAllocation], WorktreeWorkspace]] = None
    tick_seconds: float = 5.0

    _workers: dict[str, WorkerHandle] = field(default_factory=dict, init=False)
    _free_ports: list[PortAllocation] = field(default_factory=list, init=False)

    def __post_init__(self):
        self._free_ports = list(self.ports_pool)
        if self.quota_classifier is None:
            self.quota_classifier = lambda agent: _agent_hit_quota(progress_dir(), agent)
        if self.worktree_factory is None:
            self.worktree_factory = lambda name, ports: WorktreeWorkspace.create(
                self.main_repo, name=name, ports=ports)

    # --- one scheduling pass (pure given injected I/O) ------------------ #
    def tick(self) -> None:
        self._reap()
        for difficulty in self.lanes:
            while self._free_ports:
                agent = self.registry.select_and_acquire(difficulty)
                if agent is None:
                    break  # no eligible/free/healthy agent for this lane right now
                issue = self.queue.claim_ready(difficulty=difficulty, assignee=agent)
                if issue is None:
                    self.registry.release(agent)  # nothing ready in this lane; give the slot back
                    break
                self._spawn_worker(issue["id"], agent, difficulty)

    def idle(self) -> bool:
        """True when nothing is running and no lane has ready work."""
        if self._workers:
            return False
        return all(not self.queue.ready(difficulty=d, limit=1) for d in self.lanes)

    # --- internals ------------------------------------------------------ #
    def _spawn_worker(self, ticket_id: str, agent: str, difficulty: str) -> None:
        ports = self._free_ports.pop()
        try:
            wt = self.worktree_factory(ticket_id, ports)
        except Exception as e:  # creation failed → undo the claim + slot reservation
            log(f"[dispatch] worktree create failed for {ticket_id}: {e!r} — requeuing")
            self._free_ports.append(ports)
            self.registry.release(agent)
            self.queue.requeue(ticket_id, note=f"worktree create failed: {e!r}")
            return
        proc = self.spawn(ticket_id, agent, wt, ports)
        self._workers[ticket_id] = WorkerHandle(ticket_id, agent, difficulty, wt, proc)
        emit_progress_event("dispatch_spawn", {
            "ticket": ticket_id, "agent": agent, "difficulty": difficulty,
            "game_port": ports.game_server, "vite_port": ports.vite,
        })

    def _reap(self) -> None:
        for tid, w in list(self._workers.items()):
            rc = w.poll()
            if rc is None:
                continue
            self._handle_outcome(w, rc)
            del self._workers[tid]
            self.registry.release(w.agent)
            self._free_ports.append(w.worktree.ports)

    def _handle_outcome(self, w: WorkerHandle, rc: int) -> None:
        if rc == int(PipelineResult.PASS):
            emit_progress_event("dispatch_pass", {"ticket": w.ticket_id, "agent": w.agent})
            if self.on_pass is not None:
                self.on_pass(w)   # merge queue takes the branch + owns teardown
            return
        # Failure. If the agent itself hit quota/unavailability, trip the breaker.
        if self.quota_classifier(w.agent):
            log(f"[dispatch] {w.agent} hit quota/unavailable — disabling until re-enabled")
            self.registry.disable(w.agent, reason="quota or unavailable")
            emit_progress_event("agent_disabled", {"agent": w.agent, "reason": "quota"})
        self.queue.requeue(w.ticket_id, note=f"{w.agent} failed (rc={rc})")
        emit_progress_event("dispatch_requeue", {"ticket": w.ticket_id, "agent": w.agent, "rc": rc})
        w.worktree.remove_worktree()

    # --- run loop ------------------------------------------------------- #
    def run(self, *, max_idle_ticks: int = 0) -> None:
        """Poll-schedule-reap until idle (if max_idle_ticks>0) or forever."""
        idle_ticks = 0
        while True:
            self.tick()
            if self.idle():
                idle_ticks += 1
                if max_idle_ticks and idle_ticks >= max_idle_ticks:
                    log("[dispatch] backlog drained and no workers running — stopping")
                    return
            else:
                idle_ticks = 0
            time.sleep(self.tick_seconds)


def _agent_hit_quota(progress: Path, agent: str, *, lookback: int = 40) -> bool:
    """Scan the tail of the shared agent-usage.ndjson for a recent
    quota/unavailable failure by `agent`. Reuses the reason field
    record_agent_usage already writes — no pipeline threading needed."""
    import json
    quota_reasons = {"quota_or_rate_limit", "api_error_only_output", "empty_output"}
    path = Path(progress) / "agent-usage.ndjson"
    try:
        lines = path.read_text(errors="replace").splitlines()[-lookback:]
    except OSError:
        return False
    for ln in reversed(lines):
        try:
            row = json.loads(ln)
        except json.JSONDecodeError:
            continue
        model = row.get("model") or row.get("label", "")
        if agent in (row.get("label", ""), model) and row.get("reason") in quota_reasons:
            return True
    return False


__all__ = ["Dispatcher", "WorkerHandle", "subprocess_spawn"]
