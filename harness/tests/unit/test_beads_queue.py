"""BeadsQueue wrapper against a real `bd` CLI (parallel-factory Phase 2).

Skipped automatically when `bd` is not installed, so it doesn't break CI on
machines without beads.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from harness.beads import BeadsQueue, bd_available

pytestmark = pytest.mark.skipif(not bd_available(), reason="bd (beads) not installed")


@pytest.fixture
def queue(tmp_path: Path) -> BeadsQueue:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@e"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "T"], cwd=tmp_path, check=True)
    subprocess.run(["bd", "init", "--non-interactive"], cwd=tmp_path,
                   check=True, capture_output=True, text=True, env={"BD_NON_INTERACTIVE": "1", "PATH": _path()})
    return BeadsQueue(tmp_path)


def _path() -> str:
    import os
    return os.environ["PATH"]


def test_ready_respects_difficulty_and_dependencies(queue):
    easy = queue.create("easy one", difficulty="easy")
    med = queue.create("med one", difficulty="medium")
    blocked = queue.create("med blocked", difficulty="medium")
    queue.add_dep(blocked, med)  # blocked depends on med

    ready_ids = {i["id"] for i in queue.ready()}
    assert easy in ready_ids and med in ready_ids
    assert blocked not in ready_ids  # blocked by med

    med_ready = {i["id"] for i in queue.ready(difficulty="medium")}
    assert med_ready == {med}  # lane filter + blocker-aware


def test_claim_is_atomic_and_assigns(queue):
    queue.create("m1", difficulty="medium")
    claimed = queue.claim_ready(difficulty="medium", assignee="qwen")
    assert claimed is not None
    assert claimed["assignee"] == "qwen"
    assert claimed["status"] == "in_progress"
    # no longer ready (it's in_progress)
    assert queue.ready(difficulty="medium") == []


def test_requeue_returns_to_ready(queue):
    queue.create("m1", difficulty="medium")
    claimed = queue.claim_ready(difficulty="medium", assignee="qwen")
    queue.requeue(claimed["id"], note="qwen quota exhausted")
    again = queue.ready(difficulty="medium")
    assert {i["id"] for i in again} == {claimed["id"]}
    assert again[0]["status"] == "open"


def test_close_removes_from_ready(queue):
    cid = queue.create("done one", difficulty="easy")
    queue.close(cid, "completed")
    assert cid not in {i["id"] for i in queue.ready()}
