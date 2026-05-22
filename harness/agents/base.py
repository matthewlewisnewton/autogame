"""Agent ABC + shared types.

Per design doc §5.1. Phase 1 lands the type surface so downstream phases
can import-and-typecheck against stable signatures. Bodies (e.g.
Agent.run subclass implementations) ship in Phase 2.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Mapping


class UsageKind(str, Enum):
    """Bucketing for telemetry; ports the bash HARNESS_USAGE_KIND env var."""
    IMPLEMENTER  = "implementer"
    QA           = "qa"
    DECOMPOSER   = "decomposer"
    COMMITTER    = "committer"
    FINAL_REVIEW = "final_review"   # writable top-level reviewer
    REPAIR       = "repair"
    RESCUE       = "rescue"
    SPLIT        = "split"
    VISION       = "vision"


class FailureReason(str, Enum):
    """Ported verbatim from bash `cli_failure_reason` (lib.sh:297-314).

    Shared between spawn.classify, Role fallback, and telemetry — an Enum
    keeps the vocabulary in lockstep. AgentResult.exit_code preserves the
    exact rc when EXIT_NONZERO is the bucket; the bucket is what drives
    dispatch decisions.
    """
    OK                    = "ok"
    EMPTY_OUTPUT          = "empty_output"
    API_ERROR_ONLY_OUTPUT = "api_error_only_output"
    QUOTA_OR_RATE_LIMIT   = "quota_or_rate_limit"
    TIMEOUT               = "timeout"
    KILLED_AFTER_TIMEOUT  = "killed_after_timeout"
    TERMINATED_BY_SIGNAL  = "terminated_by_signal"
    EXIT_NONZERO          = "exit_nonzero"
    # Applied by scope_audit() — see §7.4 / §6.2. Treated as a tool-failure
    # by the Role fallback chain.
    SCOPE_VIOLATION       = "scope_violation"


@dataclass(frozen=True)
class Prompt:
    """A rendered prompt string + the source template path (for telemetry)."""
    body: str
    template: Path


@dataclass
class AgentInvocation:
    """Everything the wrapper needs to make one call."""
    prompt: Prompt
    timeout_s: float
    out_file: Path
    usage_kind: UsageKind


@dataclass
class AgentResult:
    rc: int                            # 0 = ok, 1 = task-failure, 2 = tool-failure
    reason: FailureReason
    exit_code: int                     # exact CLI exit code; preserves bash's exit_$rc granularity
    stdout: str
    duration_s: float
    started_at: float                  # unix epoch
    ended_at: float
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    backend_meta: Mapping[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.rc == 0 and self.reason is FailureReason.OK


# Forward type stubs to avoid circular imports in Phase 1. The real
# Workspace / TelemetrySink land in their own modules (workspace/repo.py,
# telemetry/usage.py) and will be imported here as TYPE_CHECKING blocks
# in Phase 2 if needed.
class Workspace:  # pragma: no cover — Phase 1 type stub
    """Forward-declared in agents/base.py to keep Agent.run typeable in
    Phase 1 before workspace/repo.py grows real methods. Phase 2 replaces
    this with `from harness.workspace.repo import Repo as Workspace` (or
    leaves the abstract stub here as a Protocol)."""


class TelemetrySink:  # pragma: no cover — Phase 1 type stub
    """See above; ships properly in Phase 2 with telemetry/usage.py."""


class Agent(ABC):
    """One concrete CLI backend wrapper. Subclasses own a typed config.

    Per design doc §5. Phase 1 declares the surface; concrete subclasses
    (QwenAgent, CursorAgent, AgyAgent, ClaudeAgent, QwenVisionAgent) ship
    in Phase 2 alongside spawn.py.
    """

    name: str           # e.g. "cursor/composer-2.5-fast (writable)"
    writable: bool      # may modify files in the workspace
    bucket: str         # "local" | "remote" — partitions GPU-uptime telemetry

    @abstractmethod
    def run(
        self,
        invocation: AgentInvocation,
        workspace: Workspace,
        *,
        telemetry: TelemetrySink,
    ) -> AgentResult: ...

    def available(self) -> bool:
        """Cheap check: is the backend reachable without launching it?

        Default True; QwenAgent overrides to short-circuit when ollama is
        down or qwen_disabled is set in tunables (Phase 2).
        """
        return True
