"""CursorAgent — wraps the cursor `agent` CLI.

Ports `lib.sh::run_agent_model` (~lib.sh:907-912) and
`lib.sh::run_agent_model_writable` (~lib.sh:935-940).

Two modes per the TRUST CAVEAT documented in the bash writable variant:

writable=False → ``agent -p --force --trust --mode ask --model <m> <prompt>``
    Read-only. Required for QA roles so the reviewer cannot edit the code
    it judges. KNOWN TRAP: silently falls back to printing file contents
    in chat when asked to write a file. QA prompts never ask for file
    writes; do NOT use False for implementer or top-level reviewer roles.

writable=True  → ``agent -p --force --trust --model <m> <prompt>``
    Full toolset. Required for implementer / decomposer / top-level
    reviewer / rescue / split / repair. TRUST CAVEAT: the agent CAN write
    anywhere in the workspace, including harness/. Mitigations: the
    prompt forbids edits outside the target files; Role.execute runs
    scope_audit() after the call and reverts out-of-scope edits.
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
class CursorAgentConfig:
    """YAML row: {backend: cursor, model: <id>, writable: <bool>}."""
    model: str                        # required — e.g. "composer-2.5-fast"
    writable: bool = False


class CursorAgent(Agent):
    bucket = "remote"

    def __init__(self, cfg: CursorAgentConfig):
        self.cfg = cfg
        self.writable = cfg.writable
        suffix = " (writable)" if cfg.writable else " (ask)"
        self.name = f"cursor/{cfg.model}{suffix}"

    def _build_argv(self, prompt_body: str) -> list[str]:
        argv = ["agent", "-p", "--force", "--trust", "--model", self.cfg.model]
        if not self.cfg.writable:
            argv += ["--mode", "ask"]
        argv.append(prompt_body)
        return argv

    def run(self, invocation: AgentInvocation, workspace: Workspace,
            *, telemetry: TelemetrySink) -> AgentResult:
        argv = self._build_argv(invocation.prompt.body)
        label = f"agent/{self.cfg.model}"
        return spawn(argv, invocation=invocation, workspace=workspace,
                     telemetry=telemetry, label=label, bucket=self.bucket)
