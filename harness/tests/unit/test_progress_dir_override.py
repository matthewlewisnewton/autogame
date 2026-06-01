"""HARNESS_PROGRESS_DIR pins telemetry to a shared dir (parallel-factory Phase 1)."""
from __future__ import annotations

from pathlib import Path

from harness.telemetry.progress import emit_progress_event, progress_dir
from harness.telemetry.usage import _usage_path


def test_progress_dir_defaults_to_module_relative(monkeypatch):
    monkeypatch.delenv("HARNESS_PROGRESS_DIR", raising=False)
    assert progress_dir().name == "progress"
    assert progress_dir().parent.name == "harness"


def test_progress_dir_env_override(monkeypatch, tmp_path):
    shared = tmp_path / "shared-progress"
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(shared))
    assert progress_dir() == shared
    assert _usage_path() == shared / "agent-usage.ndjson"


def test_events_written_to_override_dir(monkeypatch, tmp_path):
    shared = tmp_path / "shared-progress"
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(shared))
    monkeypatch.setenv("PROGRESS_EVENTS", "1")
    emit_progress_event("unit_test_event", {"k": "v"})
    events = shared / "events.ndjson"
    assert events.exists()
    assert "unit_test_event" in events.read_text()
