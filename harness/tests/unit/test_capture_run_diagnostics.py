"""Regression: when capture_run's wait_for_game times out, metrics.json must
carry a `harness_failure` block with log tails + signature detection so the
review LLM can distinguish a harness infra leak (port held, no game crash)
from a real game-broken result, AND so the supervisor can escalate
straight to rescue instead of burning more rounds.

Discovered on ticket 055 supervisor run (2026-05-22): vite EADDRINUSE leak
caused every round's capture to fail with `ok:false`, and the review prompt's
runtime-health rule force-failed every round despite the implementation
being correct.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from harness.steps import capture_run as cr_mod
from harness.workspace.ports import PortAllocation


@pytest.fixture
def tmp_artifacts(tmp_path: Path) -> Path:
    d = tmp_path / "round-1"
    d.mkdir()
    return d


class TestDiagnoseServersDidNotStart:
    def test_vite_eaddrinuse_signature_detected(self, tmp_artifacts, monkeypatch):
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_artifacts / "client.log").write_text(
            "error when starting dev server:\n"
            "Error: Port 5173 is already in use\n"
            "    at httpServerStart (/path/vite/...)\n"
        )
        (tmp_artifacts / "server.log").write_text("Server listening on port 3000\n")
        ports = PortAllocation(game_server=3000, vite=5173)
        diag = cr_mod._diagnose_servers_did_not_start(tmp_artifacts, ports)
        assert "vite_eaddrinuse" in diag["detected"]
        assert "Port 5173 is already in use" in diag["client_log_tail"]
        assert "Server listening" in diag["server_log_tail"]

    def test_port_holders_recorded(self, tmp_artifacts, monkeypatch):
        fake_holders = {
            5173: [(82526, "node /home/.../.bin/vite --port 5173 --strictPort")],
            3000: [],
        }
        monkeypatch.setattr(cr_mod, "_port_holders",
                             lambda port: fake_holders.get(port, []))
        (tmp_artifacts / "client.log").write_text("EADDRINUSE\n")
        (tmp_artifacts / "server.log").write_text("\n")
        ports = PortAllocation(game_server=3000, vite=5173)
        diag = cr_mod._diagnose_servers_did_not_start(tmp_artifacts, ports)
        assert diag["port_holders"]["5173"][0]["pid"] == 82526
        assert "vite" in diag["port_holders"]["5173"][0]["cmdline"]
        assert diag["port_holders"]["3000"] == []

    def test_missing_logs_marked_not_crashed(self, tmp_artifacts, monkeypatch):
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        ports = PortAllocation(game_server=3000, vite=5173)
        diag = cr_mod._diagnose_servers_did_not_start(tmp_artifacts, ports)
        assert diag["client_log_tail"] == "<missing>"
        assert diag["server_log_tail"] == "<missing>"
        assert diag["detected"] == []

    def test_capture_run_writes_harness_failure_block(self, tmp_artifacts, monkeypatch):
        """End-to-end: capture_run's wait_for_game fails → metrics.json
        carries the new harness_failure block, not a bare ok:false."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: False)
        monkeypatch.setattr(cr_mod, "stop_game", lambda: None)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_artifacts / "client.log").write_text("Port 5173 is already in use\n")
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_artifacts, game_url="http://localhost:5173",
                                 ports=ports)
        assert ok is False
        metrics = json.loads((tmp_artifacts / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert "harness_failure" in metrics
        assert "vite_eaddrinuse" in metrics["harness_failure"]["detected"]


class TestTicketPipelineDetectsAndEscalates:
    """Verify pipelines.ticket reads the harness_failure block from
    metrics.json — the wire that turns a diagnosed infra failure into
    early rescue escalation."""

    def test_read_harness_failure_round_trip(self, tmp_path):
        from harness.pipelines.ticket import _read_harness_failure
        m = tmp_path / "metrics.json"
        m.write_text(json.dumps({
            "ok": False, "error": "servers did not start",
            "harness_failure": {"detected": ["vite_eaddrinuse"]},
        }))
        result = _read_harness_failure(m)
        assert result is not None
        assert result["detected"] == ["vite_eaddrinuse"]

    def test_read_harness_failure_returns_none_when_absent(self, tmp_path):
        from harness.pipelines.ticket import _read_harness_failure
        m = tmp_path / "metrics.json"
        m.write_text(json.dumps({"ok": True, "screenshots": []}))
        assert _read_harness_failure(m) is None

    def test_read_harness_failure_handles_missing_file(self, tmp_path):
        from harness.pipelines.ticket import _read_harness_failure
        assert _read_harness_failure(tmp_path / "nope.json") is None

    def test_should_escalate_only_when_infra_detected(self):
        from harness.pipelines.ticket import should_escalate_harness_failure

        assert should_escalate_harness_failure({"detected": ["vite_eaddrinuse"]})
        assert not should_escalate_harness_failure({
            "detected": [],
            "client_log_tail": "<missing>",
            "server_log_tail": "<missing>",
        })
        assert not should_escalate_harness_failure(None)

    def test_carry_harness_failure_into_feedback_writes_escalation_block(self, tmp_path):
        from harness.pipelines.ticket import (
            TicketContext, _carry_harness_failure_into_feedback,
        )
        review_fb = tmp_path / "review_feedback.md"
        ctx = TicketContext(workspace=None, roster=None, name="t055",
                             tdir=tmp_path)
        _carry_harness_failure_into_feedback(
            ctx, review_fb, round_n=4,
            failure={"detected": ["vite_eaddrinuse"],
                     "client_log_tail": "Port 5173 is already in use"},
        )
        body = review_fb.read_text()
        assert "Harness infra escalation" in body
        assert "vite_eaddrinuse" in body
        assert "Port 5173 is already in use" in body
        # The rescue prompt keys off this exact header (see
        # harness/prompts/rescue.md INFRA-ESCALATION MODE clause).
        assert "# Harness infra escalation" in body
