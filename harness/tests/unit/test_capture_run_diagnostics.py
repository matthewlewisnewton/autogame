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

    def test_server_eaddrinuse_not_misclassified_as_vite(self, tmp_artifacts, monkeypatch):
        """Ticket 242: server listen EADDRINUSE must not be tagged vite_eaddrinuse."""
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_artifacts / "client.log").write_text(
            "[vite] Proxying /api and /socket.io → http://127.0.0.1:3000\n"
        )
        (tmp_artifacts / "server.log").write_text(
            "[server] HTTP server error: Error: listen EADDRINUSE: "
            "address already in use :::3000\n"
        )
        ports = PortAllocation(game_server=3000, vite=5173)
        diag = cr_mod._diagnose_servers_did_not_start(tmp_artifacts, ports)
        assert diag["detected"] == ["server_eaddrinuse"]

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
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
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


class TestReadPageerrors:
    """Verify _read_pageerrors reads from pageerrors.json or metrics.json."""

    def test_reads_from_pageerrors_json(self, tmp_path):
        errors = [{"message": "Uncaught ReferenceError: foo is not defined"}]
        (tmp_path / "pageerrors.json").write_text(json.dumps(errors))
        result = cr_mod._read_pageerrors(tmp_path)
        assert result == errors

    def test_reads_from_metrics_json_pageerrors(self, tmp_path):
        errors = [{"message": "TypeError: cannot read properties"}]
        (tmp_path / "metrics.json").write_text(json.dumps({
            "ok": False, "pageerrors": errors
        }))
        result = cr_mod._read_pageerrors(tmp_path)
        assert result == errors

    def test_pageerrors_json_takes_precedence(self, tmp_path):
        pe_errors = [{"message": "from pageerrors.json"}]
        m_errors = [{"message": "from metrics.json"}]
        (tmp_path / "pageerrors.json").write_text(json.dumps(pe_errors))
        (tmp_path / "metrics.json").write_text(json.dumps({"pageerrors": m_errors}))
        result = cr_mod._read_pageerrors(tmp_path)
        assert result == pe_errors

    def test_returns_empty_when_no_files(self, tmp_path):
        assert cr_mod._read_pageerrors(tmp_path) == []

    def test_returns_empty_when_invalid_json(self, tmp_path):
        (tmp_path / "pageerrors.json").write_text("not json")
        assert cr_mod._read_pageerrors(tmp_path) == []

    def test_returns_empty_when_not_a_list(self, tmp_path):
        (tmp_path / "pageerrors.json").write_text(json.dumps({"key": "value"}))
        assert cr_mod._read_pageerrors(tmp_path) == []


class TestClassifyCaptureFailure:
    """Verify _classify_capture_failure returns the correct failure kind."""

    def _make_ports(self):
        return PortAllocation(game_server=3000, vite=5173)

    def test_infra_signature_returns_harness_failure(self, tmp_path, monkeypatch):
        """When EADDRINUSE is detected, return harness_failure."""
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("Port 5173 is already in use\n")
        (tmp_path / "server.log").write_text("Server listening\n")
        result = cr_mod._classify_capture_failure(tmp_path, self._make_ports())
        assert result["ok"] is False
        assert "harness_failure" in result
        assert "vite_eaddrinuse" in result["harness_failure"]["detected"]
        assert "failure_kind" not in result

    def test_pageerrors_no_infra_returns_browser_pageerror(self, tmp_path, monkeypatch):
        """When no infra issue but pageerrors exist, return browser_pageerror."""
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("vite ready\n")
        (tmp_path / "server.log").write_text("Server listening\n")
        (tmp_path / "pageerrors.json").write_text(json.dumps([
            {"message": "Uncaught ReferenceError: x is not defined",
             "sourceURL": "http://localhost:5173/main.js", "line": 42, "column": 3}
        ]))
        result = cr_mod._classify_capture_failure(tmp_path, self._make_ports())
        assert result["ok"] is False
        assert result["failure_kind"] == "browser_pageerror"
        assert "pageerrors" in result
        assert len(result["pageerrors"]) == 1
        assert "harness_failure" not in result

    def test_no_infra_no_pageerrors_returns_capture_failed(self, tmp_path, monkeypatch):
        """When no infra issue and no pageerrors, return capture_failed."""
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("vite ready\n")
        (tmp_path / "server.log").write_text("Server listening\n")
        result = cr_mod._classify_capture_failure(tmp_path, self._make_ports())
        assert result["ok"] is False
        assert result["failure_kind"] == "capture_failed"
        assert "capture_diagnosis" in result
        assert "harness_failure" not in result

    def test_infra_takes_precedence_over_pageerrors(self, tmp_path, monkeypatch):
        """When both infra signatures AND pageerrors exist, infra wins."""
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("EADDRINUSE\n")
        (tmp_path / "server.log").write_text("\n")
        (tmp_path / "pageerrors.json").write_text(json.dumps([
            {"message": "some error"}
        ]))
        result = cr_mod._classify_capture_failure(tmp_path, self._make_ports())
        assert result["ok"] is False
        assert "harness_failure" in result
        assert "failure_kind" not in result


class TestCaptureRunClassification:
    """End-to-end: capture_run classifies failures correctly."""

    def test_servers_up_capture_fail_with_pageerrors(self, tmp_path, monkeypatch):
        """Servers start, capture fails, pageerrors present → browser_pageerror."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: False)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("vite ready\n")
        (tmp_path / "server.log").write_text("Server listening\n")
        (tmp_path / "pageerrors.json").write_text(json.dumps([
            {"message": "Uncaught Error: module load failed"}
        ]))
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "browser_pageerror"
        assert "harness_failure" not in metrics
        assert "pageerrors" in metrics

    def test_servers_up_capture_fail_no_pageerrors(self, tmp_path, monkeypatch):
        """Servers start, capture fails, no pageerrors → capture_failed."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: False)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("vite ready\n")
        (tmp_path / "server.log").write_text("Server listening\n")
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "capture_failed"
        assert "capture_diagnosis" in metrics
        assert "harness_failure" not in metrics

    def test_servers_down_with_infra_signature(self, tmp_path, monkeypatch):
        """Servers don't start, EADDRINUSE detected → harness_failure."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: False)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("Port 5173 is already in use\n")
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert "harness_failure" in metrics
        assert "vite_eaddrinuse" in metrics["harness_failure"]["detected"]

    def test_servers_down_no_infra_no_pageerrors(self, tmp_path, monkeypatch):
        """Servers don't start, no infra sig, no pageerrors → capture_failed."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: False)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("some random log\n")
        (tmp_path / "server.log").write_text("another log\n")
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "capture_failed"
        assert "capture_diagnosis" in metrics
        assert "harness_failure" not in metrics


class TestGameSmokeOkBrowserPageerror:
    """Verify game_smoke_ok handles browser_pageerror correctly."""

    def test_browser_pageerror_returns_true(self, tmp_path):
        """browser_pageerror is a code defect, game is still runnable."""
        (tmp_path / "metrics.json").write_text(json.dumps({
            "ok": False,
            "failure_kind": "browser_pageerror",
            "pageerrors": [{"message": "Uncaught Error"}],
        }))
        from harness.steps.confirm_broken import game_smoke_ok
        assert game_smoke_ok(tmp_path) is True

    def test_capture_failed_returns_false(self, tmp_path):
        """capture_failed means game didn't render properly."""
        (tmp_path / "metrics.json").write_text(json.dumps({
            "ok": False,
            "failure_kind": "capture_failed",
            "capture_diagnosis": {"detected": []},
        }))
        from harness.steps.confirm_broken import game_smoke_ok
        assert game_smoke_ok(tmp_path) is False

    def test_harness_failure_returns_false(self, tmp_path):
        """harness_failure means infra problem, game didn't start."""
        (tmp_path / "metrics.json").write_text(json.dumps({
            "ok": False,
            "error": "servers did not start",
            "harness_failure": {"detected": ["vite_eaddrinuse"]},
        }))
        from harness.steps.confirm_broken import game_smoke_ok
        assert game_smoke_ok(tmp_path) is False

    def test_ok_true_still_returns_true(self, tmp_path):
        """Normal success case is unchanged."""
        (tmp_path / "metrics.json").write_text(json.dumps({
            "ok": True, "screenshots": []
        }))
        from harness.steps.confirm_broken import game_smoke_ok
        assert game_smoke_ok(tmp_path) is True

    def test_no_failure_kind_returns_false(self, tmp_path):
        """ok:false with no failure_kind → pre-existing format, treat as broken."""
        (tmp_path / "metrics.json").write_text(json.dumps({"ok": False}))
        from harness.steps.confirm_broken import game_smoke_ok
        assert game_smoke_ok(tmp_path) is False


class TestBrowserPageerrorClassification:
    """Regression tests for the pageerror classification path added in
    ticket 139-harness-misclassifies-pageerror.  These end-to-end tests
    exercise capture_run with mocked dependencies to ensure the three
    failure branches produce the correct metrics.json structure."""

    def _make_ports(self):
        return PortAllocation(game_server=3000, vite=5173)

    def test_clean_servers_pageerrors_no_harness_failure(self, tmp_artifacts, monkeypatch):
        """Clean servers + non-empty pageerrors → no harness_failure,
        failure_kind == 'browser_pageerror'."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: False)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_artifacts / "client.log").write_text("vite ready\n")
        (tmp_artifacts / "server.log").write_text("Server listening\n")
        (tmp_artifacts / "pageerrors.json").write_text(json.dumps([
            {"message": "Uncaught ReferenceError: x is not defined",
             "sourceURL": "http://localhost:5173/main.js"}
        ]))
        ports = self._make_ports()
        ok = cr_mod.capture_run(tmp_artifacts, game_url="http://localhost:5173",
                                 ports=ports)
        assert ok is False
        metrics = json.loads((tmp_artifacts / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "browser_pageerror"
        assert "harness_failure" not in metrics
        assert "pageerrors" in metrics
        assert len(metrics["pageerrors"]) == 1

    def test_eaddrinuse_harness_failure_signatures(self, tmp_artifacts, monkeypatch):
        """Servers EADDRINUSE → harness_failure with detected signatures."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: False)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_artifacts / "client.log").write_text(
            "error when starting dev server:\n"
            "Error: Port 5173 is already in use\n"
        )
        (tmp_artifacts / "server.log").write_text("Server listening on port 3000\n")
        ports = self._make_ports()
        ok = cr_mod.capture_run(tmp_artifacts, game_url="http://localhost:5173",
                                 ports=ports)
        assert ok is False
        metrics = json.loads((tmp_artifacts / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert "harness_failure" in metrics
        assert "vite_eaddrinuse" in metrics["harness_failure"]["detected"]
        # No code-type failure_kind when infra failure is detected
        assert metrics.get("failure_kind") != "browser_pageerror"
        assert metrics.get("failure_kind") != "capture_failed"

    def test_clean_servers_empty_pageerrors_capture_diagnosis(
        self, tmp_artifacts, monkeypatch
    ):
        """Clean servers + empty pageerrors + capture failure →
        capture_diagnosis with empty detected (for human investigation)."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: False)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_artifacts / "client.log").write_text("vite ready\n")
        (tmp_artifacts / "server.log").write_text("Server listening\n")
        # No pageerrors.json — capture fails with nothing to explain it
        ports = self._make_ports()
        ok = cr_mod.capture_run(tmp_artifacts, game_url="http://localhost:5173",
                                 ports=ports)
        assert ok is False
        metrics = json.loads((tmp_artifacts / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert "capture_diagnosis" in metrics
        assert metrics["capture_diagnosis"]["detected"] == []
        assert "harness_failure" not in metrics
        assert metrics["failure_kind"] == "capture_failed"


class TestCaptureSuccessPromotesPageerrors:
    """Regression for 144: when capture() returns success but the run still
    recorded page errors, capture_run must promote the result to a
    browser_pageerror failure rather than returning True."""

    def test_capture_ok_with_pageerrors_promoted_to_failure(self, tmp_path, monkeypatch):
        """Servers up, capture succeeds, pageerrors.json non-empty →
        metrics.json gets ok:false + browser_pageerror, capture_run → False."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: True)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        (tmp_path / "client.log").write_text("vite ready\n")
        (tmp_path / "server.log").write_text("Server listening\n")
        (tmp_path / "pageerrors.json").write_text(json.dumps([
            {"message": "Uncaught TypeError: cannot read properties of undefined"}
        ]))
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "browser_pageerror"
        assert "harness_failure" not in metrics
        assert len(metrics["pageerrors"]) == 1

    def test_capture_ok_no_pageerrors_returns_true(self, tmp_path, monkeypatch):
        """Servers up, capture succeeds, no pageerrors → capture_run returns
        True and does not overwrite metrics.json with a failure."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        # capture() writes the success metrics it normally would
        def _fake_capture(u, d):
            (Path(d) / "metrics.json").write_text(
                json.dumps({"ok": True, "screenshots": []}, indent=2) + "\n"
            )
            return True
        monkeypatch.setattr(cr_mod, "capture", _fake_capture)
        monkeypatch.setattr(cr_mod, "_port_holders", lambda port: [])
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is True
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is True


class TestExceptionDuringCaptureWritesMetrics:
    """Regression: when capture() or _classify_capture_failure() raises an
    unexpected exception, capture_run must still write metrics.json with
    failure_kind == 'capture_exception' instead of silently returning False."""

    def test_exception_during_capture_writes_metrics(self, tmp_path, monkeypatch):
        """Mock capture to raise RuntimeError → metrics.json is written."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: (_ for _ in ()).throw(RuntimeError("boom")))
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "capture_exception"
        assert "boom" in metrics["error"]

    def test_exception_during_classification_writes_metrics(self, tmp_path, monkeypatch):
        """Mock _classify_capture_failure to raise → metrics.json is written."""
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: False)
        monkeypatch.setattr(cr_mod, "_classify_capture_failure",
                            lambda d, p: (_ for _ in ()).throw(ValueError("classify error")))
        ports = PortAllocation(game_server=3000, vite=5173)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert ok is False
        metrics = json.loads((tmp_path / "metrics.json").read_text())
        assert metrics["ok"] is False
        assert metrics["failure_kind"] == "capture_exception"
        assert "classify error" in metrics["error"]

    def test_stop_game_called_on_exception(self, tmp_path, monkeypatch):
        """Ensure stop_game is called even when an exception occurs."""
        stop_called = []
        launch = [111, 222]
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: launch)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(
            cr_mod, "stop_game",
            lambda *_a, **kw: stop_called.append(kw.get("pids")),
        )
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: (_ for _ in ()).throw(RuntimeError("fail")))
        ports = PortAllocation(game_server=3000, vite=5173)
        cr_mod.capture_run(tmp_path, game_url="http://localhost:5173", ports=ports)
        assert stop_called == [launch]

    def test_capture_run_passes_launch_pids_to_stop_game(self, tmp_path, monkeypatch):
        """Regression: teardown must target only this capture's launch PIDs."""
        launch = [301, 302]
        stopped: list[list[int] | None] = []
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: launch)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "capture", lambda u, d: True)
        monkeypatch.setattr(
            cr_mod, "stop_game",
            lambda *_a, **kw: stopped.append(kw.get("pids")),
        )
        ports = PortAllocation(game_server=3004, vite=5177)
        assert cr_mod.capture_run(tmp_path, game_url="http://localhost:5173/", ports=ports) is True
        assert stopped == [launch]

    def test_captures_at_allocated_vite_port_not_static_game_url(self, tmp_path, monkeypatch):
        """Regression: a parallel worker's game runs on its ALLOCATED vite port;
        the capture must hit that port, not the static game_url (which points at
        5173 — a sibling worker's port or nothing). This is what made every
        non-5173 worker's review fail with ERR_CONNECTION_REFUSED."""
        captured_url = {}
        monkeypatch.setattr(cr_mod, "start_game", lambda d, p: None)
        monkeypatch.setattr(cr_mod, "wait_for_game", lambda p, timeout_s=45: True)
        monkeypatch.setattr(cr_mod, "stop_game", lambda *_a, **_kw: None)
        monkeypatch.setattr(cr_mod, "capture",
                            lambda url, d: captured_url.setdefault("url", url) or True)
        ports = PortAllocation(game_server=3004, vite=5177)
        ok = cr_mod.capture_run(tmp_path, game_url="http://localhost:5173/", ports=ports)
        assert ok is True
        assert captured_url["url"] == "http://localhost:5177/"  # allocated, not 5173
