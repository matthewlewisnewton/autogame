"""flock-based shared-resource mutex (first consumer: the single Blender instance)."""
from __future__ import annotations

import pytest

from harness.concurrency.resource_lock import held, lock_path, resource_for_ticket


def test_lock_path_under_locks_dir():
    p = lock_path("blender")
    assert p.name == "blender.lock"
    assert "locks" in p.parts


def test_held_serializes_within_process():
    """A second acquire must block while the first is held — proven via a short
    timeout. flock treats separate open descriptions independently, so even the
    same process is denied a second exclusive lock on the file."""
    with held("blender"):
        with pytest.raises(TimeoutError):
            with held("blender", timeout=0.3, poll=0.05):
                pass
    # released after the outer block → now acquirable
    with held("blender", timeout=1.0):
        pass


def test_held_releases_on_exception():
    """An error inside the held block must still release the lock."""
    with pytest.raises(ValueError):
        with held("blender"):
            raise ValueError("boom")
    with held("blender", timeout=1.0):  # would hang/raise if still held
        pass


def test_resource_for_ticket(tmp_path):
    td = tmp_path / "t"
    td.mkdir()
    (td / "ticket.md").write_text("# Title\n\n## Resource: blender\n\nbody text")
    assert resource_for_ticket(td) == "blender"
    # case/format tolerance
    (td / "ticket.md").write_text("Resource Lock: Blender\n")
    assert resource_for_ticket(td) == "blender"
    # no marker
    (td / "ticket.md").write_text("# Title\nno resource here")
    assert resource_for_ticket(td) is None
    # missing dir
    assert resource_for_ticket(tmp_path / "nope") is None
