"""argv-construction tests for every Agent subclass.

Doc §11.1 coverage:
  - cursor: writable=True → no `--mode`; writable=False → `--mode ask`;
    `--model` always present
  - qwen: argv with/without QWEN_MODEL, openai-logging flag wiring
  - agy: REGRESSION — no `--model` flag ever appears in argv
  - claude: `--dangerously-skip-permissions` always present; model arg passed when set
"""
from __future__ import annotations

from pathlib import Path

import pytest

from harness.agents.agy import AgyAgent, AgyAgentConfig
from harness.agents.claude import ClaudeAgent, ClaudeAgentConfig
from harness.agents.cursor import CursorAgent, CursorAgentConfig
from harness.agents.qwen import (
    QwenAgent,
    QwenAgentConfig,
    QwenVisionAgent,
    QwenVisionAgentConfig,
)


# ---------------------------------------------------------------- cursor

class TestCursorArgv:
    def test_writable_true_drops_mode_ask(self):
        agent = CursorAgent(CursorAgentConfig(model="composer-2.5-fast", writable=True))
        argv = agent._build_argv("hello world")
        assert "--mode" not in argv
        assert "ask" not in argv
        # Other flags required
        assert "--force" in argv
        assert "--trust" in argv
        assert "--model" in argv
        assert "composer-2.5-fast" in argv

    def test_writable_false_adds_mode_ask(self):
        agent = CursorAgent(CursorAgentConfig(model="composer-2.5-fast", writable=False))
        argv = agent._build_argv("hello world")
        assert "--mode" in argv
        # --mode ask should be a pair (--mode followed by ask)
        mode_idx = argv.index("--mode")
        assert argv[mode_idx + 1] == "ask"

    def test_model_always_present(self):
        for model in ("composer-2.5", "composer-2.5-fast", "gpt-5.5-extra-high", "gpt-5.5-medium-fast"):
            agent = CursorAgent(CursorAgentConfig(model=model, writable=False))
            argv = agent._build_argv("p")
            assert "--model" in argv and model in argv

    def test_prompt_is_last_arg(self):
        agent = CursorAgent(CursorAgentConfig(model="composer-2.5-fast", writable=True))
        argv = agent._build_argv("THE PROMPT BODY")
        assert argv[-1] == "THE PROMPT BODY"

    def test_name_includes_mode(self):
        assert "writable" in CursorAgent(CursorAgentConfig(model="x", writable=True)).name
        assert "ask" in CursorAgent(CursorAgentConfig(model="x", writable=False)).name


# ---------------------------------------------------------------- qwen

class TestQwenArgv:
    def test_default_argv_no_model_flag(self):
        agent = QwenAgent(QwenAgentConfig(model=None, openai_logging=False))
        argv = agent._build_argv("hi", Path("/tmp/log"))
        assert argv[0] == "qwen"
        assert "-y" in argv
        assert "-m" not in argv         # no model flag when model unset

    def test_with_model(self):
        agent = QwenAgent(QwenAgentConfig(model="qwen2.5:7b", openai_logging=False))
        argv = agent._build_argv("hi", Path("/tmp/log"))
        m_idx = argv.index("-m")
        assert argv[m_idx + 1] == "qwen2.5:7b"

    def test_openai_logging_adds_flags(self):
        agent = QwenAgent(QwenAgentConfig(openai_logging=True))
        argv = agent._build_argv("hi", Path("/tmp/qwen-openai-logs"))
        assert "--openai-logging" in argv
        log_idx = argv.index("--openai-logging-dir")
        assert argv[log_idx + 1] == "/tmp/qwen-openai-logs"

    def test_openai_logging_disabled_drops_flags(self):
        agent = QwenAgent(QwenAgentConfig(openai_logging=False))
        argv = agent._build_argv("hi", Path("/tmp/log"))
        assert "--openai-logging" not in argv
        assert "--openai-logging-dir" not in argv

    def test_prompt_is_last_arg(self):
        agent = QwenAgent(QwenAgentConfig(openai_logging=False))
        argv = agent._build_argv("THE PROMPT", Path("/tmp/log"))
        assert argv[-1] == "THE PROMPT"


# ---------------------------------------------------------------- agy (regression)

class TestAgyArgv:
    def test_no_model_flag_ever(self):
        """REGRESSION: past additions of `if model: argv += ['--model', model]`
        have broken agy. The agy CLI ignores --model and the past failure mode
        was silent. This test guards every config permutation."""
        for label in ("Gemini 3.5 Flash (High)", "Gemini Default", "Custom Label"):
            agent = AgyAgent(AgyAgentConfig(model_label=label))
            argv = agent._build_argv("prompt", timeout_s=300.0)
            assert "--model" not in argv, f"agy with label={label!r} got --model"
            assert "-m" not in argv

    def test_print_timeout_set_from_outer(self):
        """Quirk #3 — agy's --print-timeout must match the outer timeout."""
        agent = AgyAgent()
        argv = agent._build_argv("p", timeout_s=720.0)
        pt_idx = argv.index("--print-timeout")
        assert argv[pt_idx + 1] == "720"

    def test_print_flag_present(self):
        agent = AgyAgent()
        argv = agent._build_argv("p", timeout_s=10.0)
        assert "--print" in argv

    def test_prompt_is_last_arg(self):
        agent = AgyAgent()
        argv = agent._build_argv("THE PROMPT", timeout_s=10.0)
        assert argv[-1] == "THE PROMPT"


# ---------------------------------------------------------------- claude

class TestClaudeArgv:
    def test_dangerous_flag_always_present(self):
        argv = ClaudeAgent()._build_argv("p")
        assert "--dangerously-skip-permissions" in argv
        argv2 = ClaudeAgent(ClaudeAgentConfig(model="claude-opus-4-7"))._build_argv("p")
        assert "--dangerously-skip-permissions" in argv2

    def test_model_arg_passed_when_set(self):
        argv = ClaudeAgent(ClaudeAgentConfig(model="claude-opus-4-7"))._build_argv("p")
        m_idx = argv.index("--model")
        assert argv[m_idx + 1] == "claude-opus-4-7"

    def test_model_arg_omitted_when_unset(self):
        argv = ClaudeAgent(ClaudeAgentConfig(model=None))._build_argv("p")
        assert "--model" not in argv

    def test_print_flag_present(self):
        assert "-p" in ClaudeAgent()._build_argv("hi")

    def test_prompt_is_last_arg(self):
        assert ClaudeAgent()._build_argv("THE PROMPT")[-1] == "THE PROMPT"
