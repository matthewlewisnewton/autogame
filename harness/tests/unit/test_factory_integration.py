"""End-to-end factory flow through REAL beads (spawn + git + verify faked).

Exercises: migrate TASKS.md -> beads, dispatcher claims ready work, worker
"passes", merge queue closes the bead. Skips when `bd` is absent.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from harness.beads import BeadsQueue, bd_available
from harness.dispatch.dispatcher import Dispatcher
from harness.dispatch.merge_queue import MergeQueue
from harness.dispatch.migrate import migrate_open_tickets
from harness.dispatch.registry import AgentRegistry, AgentSpec
from harness.pipelines.result import PipelineResult
from harness.workspace.ports import PortAllocation

pytestmark = pytest.mark.skipif(not bd_available(), reason="bd (beads) not installed")


class _Proc:
    def __init__(self, rc):
        self._rc = rc

    def poll(self):
        return self._rc


class _Worktree:
    def __init__(self, name, ports):
        self.branch = f"auto/{name}"
        self.root = f"/wt/{name}"
        self.ports = ports
        self.removed = False

    def remove_worktree(self, **kw):
        self.removed = True
        return True


def _init_repo(tmp_path: Path) -> BeadsQueue:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@e"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "T"], cwd=tmp_path, check=True)
    import os
    subprocess.run(["bd", "init", "--non-interactive"], cwd=tmp_path, check=True,
                   capture_output=True, text=True,
                   env={"BD_NON_INTERACTIVE": "1", "PATH": os.environ["PATH"]})
    return BeadsQueue(tmp_path)


def test_full_flow_migrate_claim_pass_merge_close(tmp_path):
    # one easy ticket in TASKS.md
    (tmp_path / "TASKS.md").write_text("# Tasks\n- [ ] [t-easy](tickets/t-easy/)\n")
    (tmp_path / "tickets" / "t-easy").mkdir(parents=True)
    (tmp_path / "tickets" / "t-easy" / "ticket.md").write_text("# T\n## Difficulty: easy\n")
    queue = _init_repo(tmp_path)

    created = migrate_open_tickets(tmp_path, queue)
    assert set(created) == {"t-easy"}
    assert [i["title"] for i in queue.ready()] == ["t-easy"]

    # merge queue with faked git/verify (real beads close)
    mq = MergeQueue(main_repo=None, queue=queue,
                    rebase=lambda h: True, verify=lambda root: True, merge=lambda h: True)

    registry = AgentRegistry(
        [AgentSpec("qwen", 1, frozenset({"easy"}))], {"easy": ["qwen"]})

    disp = Dispatcher(
        queue=queue, registry=registry, main_repo=None,
        ports_pool=[PortAllocation(3000, 5173)], lanes=["easy"],
        spawn=lambda name, agent, wt, ports: _Proc(int(PipelineResult.PASS)),
        worktree_factory=lambda name, ports: _Worktree(name, ports),
        quota_classifier=lambda agent: False,
        on_pass=mq.enqueue, merge_drain=mq.drain_one,
    )

    disp.tick()                       # claim t-easy (real bd) + spawn (passes immediately)
    assert queue.ready() == []        # claimed → no longer ready
    disp.tick()                       # reap PASS → enqueue merge → drain → bd close
    # bead is closed: not ready, not in_progress
    assert queue.ready() == []
    assert [i["id"] for i in queue.in_progress()] == []
