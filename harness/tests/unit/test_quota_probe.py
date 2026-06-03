"""Tests for the isolated quota probe + the dispatcher's auto-recovery path."""
from __future__ import annotations

import subprocess

from harness.dispatch.quota_probe import probe_agent_quota


class _Proc:
    def __init__(self, returncode, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class _RemoteAgent:
    bucket = "remote"
    name = "cursor/composer-2.5 (writable)"

    def _build_argv(self, prompt_body):
        return ["agent", "-p", "--force", "--trust", "--model", "composer-2.5", prompt_body]


class _LocalAgent:
    bucket = "local"
    name = "qwen"

    def _build_argv(self, prompt_body, openai_log_dir=None):
        return ["qwen", prompt_body]


def _runner(proc, *, capture=None):
    def run(argv, cwd=None, capture_output=None, text=None, timeout=None):
        if capture is not None:
            capture["argv"] = argv
            capture["cwd"] = cwd
        if isinstance(proc, Exception):
            raise proc
        return proc
    return run


def test_clean_ok_means_recovered():
    cap = {}
    assert probe_agent_quota(_RemoteAgent(), runner=_runner(_Proc(0, "OK\n"), capture=cap)) is True
    # ran the agent's own argv, in a throwaway dir (not the repo)
    assert cap["argv"][0] == "agent" and "composer-2.5" in cap["argv"]
    assert "/quota-probe-" in cap["cwd"] or cap["cwd"].startswith("/tmp")


def test_quota_message_means_still_out():
    # the new cursor substrings must classify as quota, not OK
    assert probe_agent_quota(_RemoteAgent(),
                             runner=_runner(_Proc(1, "You're out of usage. Increase your limit."))) is False
    assert probe_agent_quota(_RemoteAgent(),
                             runner=_runner(_Proc(1, "You have an unpaid invoice."))) is False


def test_nonzero_without_quota_text_is_still_out():
    assert probe_agent_quota(_RemoteAgent(), runner=_runner(_Proc(2, "some other error"))) is False


def test_local_agent_not_probed():
    assert probe_agent_quota(_LocalAgent(), runner=_runner(_Proc(0, "OK"))) is None


def test_missing_cli_is_undetermined():
    assert probe_agent_quota(_RemoteAgent(),
                             runner=_runner(FileNotFoundError("agent not found"))) is None


def test_timeout_is_still_out():
    assert probe_agent_quota(
        _RemoteAgent(),
        runner=_runner(subprocess.TimeoutExpired(cmd="agent", timeout=30))) is False


def test_none_agent_is_undetermined():
    assert probe_agent_quota(None) is None
