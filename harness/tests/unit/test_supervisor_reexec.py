"""Re-exec guard for the unified repair path.

After a committed harness repair the supervisor re-execs a fresh interpreter so
the new modules load. The guard (HARNESS_REEXEC_COUNT vs max_reexecs) must stop
a repair that never actually fixes anything from thrashing forever.
"""
from __future__ import annotations

import pytest

from harness.supervisor import Supervisor, _REEXEC_ENV
from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo


def _sup(tmp_path, max_reexecs=3):
    return Supervisor(workspace=Repo(root=tmp_path, ports=PortAllocation()),
                      max_reexecs=max_reexecs)


def test_reexec_increments_and_execs(tmp_path, monkeypatch):
    monkeypatch.delenv(_REEXEC_ENV, raising=False)
    calls = {}
    monkeypatch.setattr("harness.supervisor.os.execv",
                        lambda exe, argv: calls.setdefault("argv", argv))
    _sup(tmp_path)._reexec_to_load_repair()
    assert calls["argv"][-1] == "supervisor"      # re-launches the supervisor
    assert calls["argv"][1:] == ["-m", "harness", "supervisor"]
    assert os_environ_count(monkeypatch) == 1     # budget consumed


def test_reexec_stops_after_budget(tmp_path, monkeypatch):
    monkeypatch.setenv(_REEXEC_ENV, "3")          # already at max
    monkeypatch.setattr("harness.supervisor.os.execv",
                        lambda *a: (_ for _ in ()).throw(AssertionError("must not execv")))
    with pytest.raises(SystemExit):
        _sup(tmp_path, max_reexecs=3)._reexec_to_load_repair()


def os_environ_count(monkeypatch) -> int:
    import os
    return int(os.environ.get(_REEXEC_ENV, "0"))
