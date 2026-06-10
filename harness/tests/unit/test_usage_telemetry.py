"""record_agent_usage: ndjson row + the live-view agent_usage event.

Factory workers ran with telemetry=None for weeks (token totals froze at the
bash cutover; the dispatcher quota scan read a dead agent-usage.ndjson), so
these pin the now-wired behavior: every recorded usage writes a snake_case
row AND emits the camelCase `agent_usage` event server.mjs ingests.
"""
from __future__ import annotations

import json

import pytest

from harness.agents.base import AgentResult, FailureReason, UsageKind
from harness.telemetry.usage import record_agent_usage


@pytest.fixture
def progress(tmp_path, monkeypatch):
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(tmp_path))
    return tmp_path


def _result(*, input_tokens=0, output_tokens=0):
    return AgentResult(
        rc=0, reason=FailureReason.OK, exit_code=0, stdout="",
        duration_s=2.5, started_at=1000.0, ended_at=1002.5,
        input_tokens=input_tokens, output_tokens=output_tokens)


def test_records_row_and_emits_exact_usage_event(progress):
    record_agent_usage(
        label="agent/gpt-5.5", result=_result(input_tokens=100, output_tokens=50),
        attempt=1, usage_kind=UsageKind.FINAL_REVIEW, bucket="remote",
        prompt="p" * 400, outfile="/wt/review-round-1/agent.txt")
    row = json.loads((progress / "agent-usage.ndjson").read_text().splitlines()[0])
    assert row["outfile"] == "/wt/review-round-1/agent.txt"
    events = [json.loads(l) for l in (progress / "events.ndjson").read_text().splitlines()]
    usage = [e for e in events if e["type"] == "agent_usage"]
    assert len(usage) == 1
    p = usage[0]["payload"]
    assert p["totalTokens"] == 150 and p["estimated"] is False
    assert p["bucket"] == "remote" and p["usageKind"] == "final_review"
    assert p["outfile"] == "/wt/review-round-1/agent.txt" and p["attempt"] == 1


def test_estimates_tokens_when_cli_reports_none(progress):
    record_agent_usage(
        label="qwen", result=_result(), attempt=1,
        usage_kind=UsageKind.IMPLEMENTER, bucket="local",
        prompt="x" * 4000, outfile="/wt/round-1/qwen.txt")
    events = [json.loads(l) for l in (progress / "events.ndjson").read_text().splitlines()]
    p = [e for e in events if e["type"] == "agent_usage"][0]["payload"]
    assert p["totalTokens"] == 1000          # ~4 chars/token estimate
    assert p["estimated"] is True and p["source"] == "per_call_estimate"
