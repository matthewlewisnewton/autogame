"""Test isolation: never touch the LIVE factory's telemetry or processes.

Two side effects in the harness code are real and global, so a plain unit-test
run against a checkout where a parallel factory is live would corrupt it:

  (a) emit_progress_event() appends to harness/progress/events.ndjson — tests
      would pollute the live event stream / live view with fake events.
  (b) factory.reconcile() calls _kill_stray_workers() = `pkill -f "harness
      worker"`, which would SIGTERM the live factory's worker subprocesses.

Both are neutralized here for every test. Tests that specifically exercise these
(e.g. test_progress_dir_*) override via their own monkeypatch, which is applied
after this autouse fixture and so wins.
"""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolate_live_side_effects(monkeypatch, tmp_path_factory):
    # (a) pin telemetry to a throwaway dir so emits never hit the live file
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(tmp_path_factory.mktemp("progress")))
    # (b) make reconcile's stray-worker pkill a no-op in tests
    import harness.dispatch.factory as factory
    monkeypatch.setattr(factory, "_kill_stray_workers", lambda: None)
