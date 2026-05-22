"""QwenAgent + QwenVisionAgent.

Ports `lib.sh::run_qwen` (~lib.sh:808-827) and `lib.sh::run_qwen_vision`
(~lib.sh:884-908) + the inline `write_qwen_vision_settings` JSON config
generator into Python.

Failure modes the wrapper handles (via spawn() retries):
  - Empty output → EMPTY_OUTPUT
  - "exhausted your capacity on this model" → QUOTA_OR_RATE_LIMIT
  - Hard timeout → TIMEOUT (SIGTERM) → KILLED_AFTER_TIMEOUT (SIGKILL grace 30s)

available() returns False when tunables.qwen_disabled is True (mirrors
the bash QWEN_DISABLED knob and the runtime.env override).
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from harness.agents.base import (
    Agent,
    AgentInvocation,
    AgentResult,
    FailureReason,
    TelemetrySink,
    Workspace,
)
from harness.agents.spawn import spawn


@dataclass
class QwenAgentConfig:
    """Typed config for QwenAgent. Loaded from a YAML row whose
    `backend: qwen` discriminator selects this class."""
    model: Optional[str] = None                    # None → qwen default
    openai_logging: bool = True                    # bash QWEN_OPENAI_LOGGING default 1


@dataclass
class QwenVisionAgentConfig:
    """Typed config for QwenVisionAgent. Points qwen at a local Ollama via
    a generated settings file and adds the playwright MCP."""
    vision_model: str = "qwen3.6:27b-q8_0"         # bash QWEN_VISION_MODEL default
    vision_base_url: str = "http://localhost:11434/v1"
    vision_api_key: str = "ollama"
    openai_logging: bool = False                   # bash QWEN_VISION_OPENAI_LOGGING default 0


def _qwen_disabled() -> bool:
    """Read the tunable. Phase 2 falls back to env var; Phase 3's
    config.tunables.get_tunables() becomes the canonical source."""
    try:
        from harness.config.tunables import get_tunables  # type: ignore
        return bool(getattr(get_tunables(), "qwen_disabled", False))
    except Exception:
        pass
    return os.environ.get("QWEN_DISABLED", "0") == "1"


class QwenAgent(Agent):
    """Local qwen-code CLI wrapper.

    bash run_qwen: ``qwen -y [--openai-logging --openai-logging-dir <dir>]
                  [-m <QWEN_MODEL>] <prompt>``

    When `qwen_disabled` is set, available() returns False and run() emits
    a synthetic tool-failure without invoking the CLI.
    """

    bucket = "local"
    writable = True                       # qwen always writes when asked

    def __init__(self, cfg: Optional[QwenAgentConfig] = None):
        self.cfg = cfg or QwenAgentConfig()
        model = self.cfg.model or "default"
        self.name = f"qwen/{model}"

    def available(self) -> bool:
        return not _qwen_disabled()

    def _build_argv(self, prompt_body: str, openai_log_dir: Path) -> list[str]:
        argv = ["qwen", "-y"]
        if self.cfg.openai_logging:
            argv += ["--openai-logging", "--openai-logging-dir", str(openai_log_dir)]
        if self.cfg.model:
            argv += ["-m", self.cfg.model]
        argv.append(prompt_body)
        return argv

    def run(self, invocation: AgentInvocation, workspace: Workspace,
            *, telemetry: TelemetrySink) -> AgentResult:
        if not self.available():
            return _synthesize_disabled_result(
                invocation, marker="[qwen disabled — qwen_disabled=true]\n")
        openai_log_dir = invocation.out_file.parent / "qwen-openai-logs"
        argv = self._build_argv(invocation.prompt.body, openai_log_dir)
        return spawn(argv, invocation=invocation, workspace=workspace,
                     telemetry=telemetry, label="qwen", bucket=self.bucket)


class QwenVisionAgent(Agent):
    """Vision variant: same CLI, different settings file. Settings JSON is
    generated per-call into the artifacts dir; QWEN_CODE_SYSTEM_SETTINGS_PATH
    tells qwen to load it.

    bash run_qwen_vision: ``env QWEN_CODE_SYSTEM_SETTINGS_PATH=<settings>
                         qwen -y -p <prompt>
                         [--openai-logging --openai-logging-dir <dir>]``
    """

    bucket = "local"
    writable = False                      # vision is a read-only enrichment step

    def __init__(self, cfg: Optional[QwenVisionAgentConfig] = None):
        self.cfg = cfg or QwenVisionAgentConfig()
        self.name = f"qwen-vision/{self.cfg.vision_model}"

    def available(self) -> bool:
        return not _qwen_disabled()

    def _write_settings(self, settings_path: Path, mcp_output_dir: Path) -> None:
        """Generate the qwen settings JSON. Ported from
        lib.sh::write_qwen_vision_settings."""
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        mcp_output_dir.mkdir(parents=True, exist_ok=True)
        config = {
            "env": {"OLLAMA_API_KEY": self.cfg.vision_api_key},
            "model": {
                "name": self.cfg.vision_model,
                "generationConfig": {
                    "contextWindowSize": 131072,
                    "modalities": {"image": True},
                    "splitToolMedia": True,
                    "samplingParams": {"temperature": 0.2, "top_p": 0.95},
                },
            },
            "modelProviders": {
                "openai": [{
                    "id": self.cfg.vision_model,
                    "name": f"{self.cfg.vision_model} local vision",
                    "envKey": "OLLAMA_API_KEY",
                    "baseUrl": self.cfg.vision_base_url,
                    "generationConfig": {
                        "contextWindowSize": 131072,
                        "modalities": {"image": True},
                        "splitToolMedia": True,
                        "samplingParams": {"temperature": 0.2, "top_p": 0.95},
                    },
                }],
            },
            "mcpServers": {
                "playwright": {
                    "command": "npx",
                    "args": ["-y", "@playwright/mcp", "--headless", "--isolated",
                             "--caps", "vision", "--output-dir", str(mcp_output_dir)],
                    "trust": True,
                    "timeout": 30000,
                },
            },
            "mcp": {"allowed": ["playwright"]},
            "$version": 4,
        }
        settings_path.write_text(json.dumps(config, indent=2) + "\n")

    def run(self, invocation: AgentInvocation, workspace: Workspace,
            *, telemetry: TelemetrySink) -> AgentResult:
        if not self.available():
            return _synthesize_disabled_result(
                invocation, marker="[qwen vision disabled — qwen_disabled=true]\n")

        artifacts_dir = invocation.out_file.parent
        settings_file = artifacts_dir / "qwen-vision-settings.json"
        mcp_output_dir = artifacts_dir / "qwen-vision-mcp"
        self._write_settings(settings_file, mcp_output_dir)

        argv = ["qwen", "-y", "-p", invocation.prompt.body]
        if self.cfg.openai_logging:
            argv += ["--openai-logging",
                     "--openai-logging-dir", str(artifacts_dir / "qwen-openai-logs")]

        # `env QWEN_CODE_SYSTEM_SETTINGS_PATH=…` in bash maps to a subprocess
        # env override. spawn() doesn't take env= yet (Phase 3 may add it);
        # for now, set on the parent env across the call. The change is
        # scoped to this thread's view of os.environ via try/finally.
        original = os.environ.get("QWEN_CODE_SYSTEM_SETTINGS_PATH")
        os.environ["QWEN_CODE_SYSTEM_SETTINGS_PATH"] = str(settings_file)
        try:
            return spawn(argv, invocation=invocation, workspace=workspace,
                         telemetry=telemetry, label="qwen-vision", bucket=self.bucket)
        finally:
            if original is None:
                os.environ.pop("QWEN_CODE_SYSTEM_SETTINGS_PATH", None)
            else:
                os.environ["QWEN_CODE_SYSTEM_SETTINGS_PATH"] = original


# --- helpers --------------------------------------------------------------- #

def _synthesize_disabled_result(invocation: AgentInvocation, *, marker: str) -> AgentResult:
    """Build a tool-failure AgentResult without invoking any subprocess.
    Used by available()==False paths. The marker is written to the
    invocation's outfile so callers / fixtures see why the call returned."""
    invocation.out_file.parent.mkdir(parents=True, exist_ok=True)
    invocation.out_file.write_text(marker)
    now = time.time()
    return AgentResult(
        rc=2,
        reason=FailureReason.EMPTY_OUTPUT,
        exit_code=-1,                     # synthetic; never ran
        stdout=marker,
        duration_s=0.0,
        started_at=now,
        ended_at=now,
        backend_meta={"disabled": "true"},
    )
