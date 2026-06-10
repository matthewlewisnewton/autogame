"""ClaudeAgent — wraps the `claude` CLI.

Ports `lib.sh::run_claude` (lib.sh:1169-1172).

bash run_claude: ``claude -p --dangerously-skip-permissions
                [--model <CLAUDE_MODEL>] <prompt>``

`--dangerously-skip-permissions` is always on for the autonomous loop;
the operator is the only consent boundary. The flag's name is loud on
purpose — every other path the harness uses should reject it.

Used as last-resort QA tier, as the rescue role, and as the supervisor's
repair role. Writable (claude can edit files when asked).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from harness.agents.base import (
    Agent,
    AgentInvocation,
    AgentResult,
    TelemetrySink,
    Workspace,
)
from harness.agents.spawn import spawn


@dataclass
class ClaudeAgentConfig:
    """YAML row: {backend: claude} or {backend: claude, model: <id>, effort: <level>}."""
    model: Optional[str] = None       # None → claude CLI default
    effort: Optional[str] = None      # None → CLI default; else low|medium|high|xhigh|max


class ClaudeAgent(Agent):
    bucket = "remote"
    writable = True

    def __init__(self, cfg: Optional[ClaudeAgentConfig] = None):
        self.cfg = cfg or ClaudeAgentConfig()
        suffix = self.cfg.model or "default"
        if self.cfg.effort:
            suffix = f"{suffix}@{self.cfg.effort}"
        self.name = f"claude/{suffix}"

    def _build_argv(self, prompt_body: str) -> list[str]:
        argv = ["claude", "-p", "--dangerously-skip-permissions"]
        if self.cfg.model:
            argv += ["--model", self.cfg.model]
        if self.cfg.effort:
            argv += ["--effort", self.cfg.effort]
        argv.append(prompt_body)
        return argv

    def run(self, invocation: AgentInvocation, workspace: Workspace,
            *, telemetry: TelemetrySink) -> AgentResult:
        argv = self._build_argv(invocation.prompt.body)
        return spawn(argv, invocation=invocation, workspace=workspace,
                     telemetry=telemetry, label="claude", bucket=self.bucket)
