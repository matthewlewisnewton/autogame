"""Tunables — non-role configuration knobs shared across the harness.

Per design doc §6.3 `tunables:` YAML section. These knobs are
hot-reloadable at the supervisor-invocation boundary (same as roles).
They replace the bash `${X:-default}` env-var soup AND the live-override
file `harness/tmp/runtime.env`.

The active Tunables instance is the one held by the Supervisor's loaded
Roster. Agents that need read access (e.g. QwenAgent checking
qwen_disabled) call `get_tunables()` which delegates to the active
roster, falling back to defaults + env-var overrides for unit-test
scenarios where no roster is loaded.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# --- Pydantic models — what loads from YAML -------------------------------- #

class PipelineTunables(BaseModel):
    """tunables.pipeline.* block."""
    model_config = ConfigDict(extra="forbid")
    local_checks: bool = True
    check_cwd: str = "game"
    server_timeout_s: int = 300
    client_timeout_s: int = 120
    coverage_enabled: bool = True
    coverage_timeout_s: int = 120


class VisionTunables(BaseModel):
    """tunables.vision.* block."""
    model_config = ConfigDict(extra="forbid")
    feedback_on_fail: bool = True
    timeout_s: int = 900


class Tunables(BaseModel):
    """Top-level tunables. Field names match doc §6.3 verbatim."""
    model_config = ConfigDict(extra="forbid")
    max_iter: int = 5
    ticket_max_rounds: int = 10
    game_url: str = "http://localhost:5173"
    pipeline: PipelineTunables = Field(default_factory=PipelineTunables)
    vision: VisionTunables = Field(default_factory=VisionTunables)
    qwen_disabled: bool = False
    cli_retries: int = 2
    cli_retry_backoff_s: int = 20
    agent_timeout_s: int = 720


# --- Process-global accessor ---------------------------------------------- #

_ACTIVE: Optional[Tunables] = None


def set_active(t: Tunables) -> None:
    """Called by the Roster loader (Supervisor at start-of-loop / SIGHUP)."""
    global _ACTIVE
    _ACTIVE = t


def get_tunables() -> Tunables:
    """Read accessor. Falls back to defaults overlaid with env vars when
    no roster has been loaded (test scenarios, doctor subcommand)."""
    if _ACTIVE is not None:
        return _ACTIVE
    # Defaults + env overrides — only the knobs that have shipped env
    # equivalents in the bash. Adding new env mappings is intentional
    # work; the YAML is the canonical source.
    return Tunables(
        qwen_disabled=os.environ.get("QWEN_DISABLED", "0") == "1",
        cli_retries=int(os.environ.get("CLI_RETRIES", "2")),
        cli_retry_backoff_s=int(os.environ.get("CLI_RETRY_BACKOFF", "20")),
    )


__all__ = ["PipelineTunables", "Tunables", "VisionTunables", "get_tunables", "set_active"]
