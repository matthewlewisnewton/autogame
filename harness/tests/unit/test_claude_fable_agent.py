"""claude_fable: fable-5 @ xhigh effort, hard-lane-only factory implementer."""
from __future__ import annotations

from pathlib import Path

import harness
from harness.agents.claude import ClaudeAgent, ClaudeAgentConfig
from harness.dispatch.factory import load_factory_config
from harness.roles import Roster

_ROLES_YAML = Path(harness.__file__).resolve().parent / "roles.yaml"
_MAIN_ROOT = Path(harness.__file__).resolve().parents[1]


def test_effort_flag_in_argv():
    agent = ClaudeAgent(ClaudeAgentConfig(model="claude-fable-5", effort="xhigh"))
    argv = agent._build_argv("do the thing")
    assert argv[:2] == ["claude", "-p"]
    assert ["--model", "claude-fable-5"] == argv[argv.index("--model"):argv.index("--model") + 2]
    assert ["--effort", "xhigh"] == argv[argv.index("--effort"):argv.index("--effort") + 2]
    assert agent.name == "claude/claude-fable-5@xhigh"


def test_no_effort_omits_flag():
    agent = ClaudeAgent(ClaudeAgentConfig(model="claude-opus-4-8"))
    assert "--effort" not in agent._build_argv("x")
    assert agent.name == "claude/claude-opus-4-8"


def test_roster_resolves_claude_fable():
    roster = Roster.load(_ROLES_YAML, None)
    assert "claude_fable" in roster.agents
    assert roster.agents["claude_fable"].name == "claude/claude-fable-5@xhigh"


def test_factory_config_caps_fable_to_hard_lane():
    cfg = load_factory_config(_MAIN_ROOT)
    spec = {s.name: s for s in cfg.specs}["claude_fable"]
    assert spec.eligible == frozenset({"hard"})
    assert spec.max_concurrency == 1
    assert "claude_fable" in cfg.order
