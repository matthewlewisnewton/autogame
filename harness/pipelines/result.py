"""Shared return-code protocol for the subtask → ticket → backlog → supervisor
pipeline chain.

These were previously bare integers (0/1/2/3) with their meaning re-documented
in each pipeline's module docstring. PipelineResult names them once so the
control flow is self-describing. It subclasses IntEnum, so existing integer
comparisons (`rc == 2`) and returns keep working unchanged.
"""
from __future__ import annotations

from enum import IntEnum


class PipelineResult(IntEnum):
    PASS = 0        # succeeded and committed
    INCOMPLETE = 1  # genuine failure after all in-pipeline recovery — retryable
    ESCALATE = 2    # the harness/tooling itself failed — needs automated/human repair
    SPLIT = 3       # restructured into smaller tickets — backlog should re-scan


__all__ = ["PipelineResult"]
