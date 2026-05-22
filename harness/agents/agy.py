"""AgyAgent — Antigravity CLI (Gemini 3.5 Flash, High).

PORTED-OVER QUIRKS (each a real bash bugfix; protected by unit tests):

1. NO --model flag. The model is pinned globally via the interactive
   `/model` slash command and persisted server-side. `model_label` is
   metadata-only and exists for telemetry partitioning, not for argv.
   Past "if model: argv += ['--model', model]" snippets have broken agy.
   Regression test: tests/unit/test_agy.py asserts --model never appears.

2. Empty `workspaceDirs` in print mode. agy ignores cwd; all `@file`
   references in the prompt must be absolute. The Prompt renderer
   (Phase 3) handles this.

3. agy's internal `--print-timeout` must be set from the outer timeout
   so it doesn't cap below us. Pass it explicitly.

4. NO spawn retries. Per the bash `case "$label" in gemini|agy)
   max_retries=0`: a tier-level fallback IS the retry for agy. Burning
   3 × 12-min retries on the same broken cloud call before promoting
   to the next reviewer is dead wall-clock.
"""

from __future__ import annotations

from dataclasses import dataclass

from harness.agents.base import (
    Agent,
    AgentInvocation,
    AgentResult,
    TelemetrySink,
    Workspace,
)
from harness.agents.spawn import spawn


@dataclass
class AgyAgentConfig:
    """YAML row: {backend: agy, model_label: "Gemini 3.5 Flash (High)"}."""
    model_label: str = "Gemini 3.5 Flash (High)"     # telemetry-only; not an argv flag


class AgyAgent(Agent):
    bucket = "remote"
    writable = False                      # agy in our setup is a read-only reviewer

    def __init__(self, cfg: AgyAgentConfig | None = None):
        self.cfg = cfg or AgyAgentConfig()
        self.name = f"agy/{self.cfg.model_label}"

    def _build_argv(self, prompt_body: str, timeout_s: float) -> list[str]:
        # --print-timeout uses agy's internal cap; we set it from the outer
        # timeout so agy doesn't terminate early before our SIGTERM fires.
        # NO --model flag — see class docstring quirk #1.
        return ["agy", "--print", "--print-timeout", str(int(timeout_s)), prompt_body]

    def run(self, invocation: AgentInvocation, workspace: Workspace,
            *, telemetry: TelemetrySink) -> AgentResult:
        argv = self._build_argv(invocation.prompt.body, invocation.timeout_s)
        return spawn(argv, invocation=invocation, workspace=workspace,
                     telemetry=telemetry, label="agy", bucket=self.bucket,
                     retries=0)  # quirk #4 — the deliberate zero
