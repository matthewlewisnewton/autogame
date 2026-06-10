"""Roster loader — reads roles.yaml + (optional) roles.local.yaml, applies
field-level merge, constructs typed Roster + concrete Agent instances.

Per doc §6.5 (hot reload at supervisor invocation only — Supervisor SIGHUP
handler calls Roster.load() and assigns to self.roster) and §6.6
(field-level merge with recursive nested-object merge + whole-list replacement
for lists).
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Optional

import yaml

from harness.agents.base import Agent
from harness.agents.agy import AgyAgent, AgyAgentConfig
from harness.agents.claude import ClaudeAgent, ClaudeAgentConfig
from harness.agents.cursor import CursorAgent, CursorAgentConfig
from harness.agents.qwen import (
    QwenAgent,
    QwenAgentConfig,
    QwenVisionAgent,
    QwenVisionAgentConfig,
)
from harness.config.schema import RosterFile, AgentSpec, AgySpec, ClaudeSpec, CursorSpec, QwenSpec
from harness.config.tunables import Tunables, set_active as set_active_tunables


SCHEMA_VERSION = 1


def merge_local(base: dict, local: Optional[dict]) -> dict:
    """Field-level merge per doc §6.6.

      - Nested mappings merge recursively.
      - Scalars in `local` replace scalars in `base`.
      - LISTS REPLACE WHOLE (not append/extend). The doc says: "operator
        usually wants 'use exactly this chain, not a partial subset' —
        use fallbacks_by_difficulty for per-difficulty overrides instead".

    Edge cases:
      - Missing local → return deepcopy of base.
      - Missing base → return deepcopy of local.
      - Mismatched types (base dict vs local scalar) → local wins.
    """
    if not local:
        return deepcopy(base)
    if not base:
        return deepcopy(local)

    out = deepcopy(base)
    for key, lval in local.items():
        if key in out and isinstance(out[key], dict) and isinstance(lval, dict):
            out[key] = merge_local(out[key], lval)
        else:
            out[key] = deepcopy(lval)
    return out


def _build_agent(name: str, spec: AgentSpec) -> Agent:
    """Materialize one named Agent instance from its typed spec."""
    if isinstance(spec, QwenSpec):
        if spec.is_vision:
            cfg = QwenVisionAgentConfig(
                vision_model=spec.vision_model,
                vision_base_url=spec.vision_base_url,
                vision_api_key=spec.vision_api_key,
                openai_logging=spec.openai_logging,
            )
            return QwenVisionAgent(cfg)
        return QwenAgent(QwenAgentConfig(model=spec.model, openai_logging=spec.openai_logging))
    if isinstance(spec, CursorSpec):
        return CursorAgent(CursorAgentConfig(model=spec.model, writable=spec.writable))
    if isinstance(spec, AgySpec):
        return AgyAgent(AgyAgentConfig(model_label=spec.model_label))
    if isinstance(spec, ClaudeSpec):
        return ClaudeAgent(ClaudeAgentConfig(model=spec.model, effort=spec.effort))
    raise ValueError(f"Unsupported agent spec for {name!r}: {type(spec).__name__}")


def load_roster_files(base_path: Path, local_path: Optional[Path] = None) -> RosterFile:
    """Read + merge + validate. Raises pydantic ValidationError on bad
    schema and ValueError on missing required references."""
    if not base_path.exists():
        raise FileNotFoundError(f"roles.yaml not found at {base_path}")
    with base_path.open() as f:
        base_raw = yaml.safe_load(f) or {}
    local_raw: Optional[dict] = None
    if local_path and local_path.exists():
        with local_path.open() as f:
            local_raw = yaml.safe_load(f) or {}
    merged = merge_local(base_raw, local_raw)
    if merged.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(
            f"roles.yaml schema_version must be {SCHEMA_VERSION}; "
            f"got {merged.get('schema_version')!r}. "
            f"See harness/docs/python-rewrite.md §6.3 / Q12."
        )
    return RosterFile.model_validate(merged)


# Inline Roster import deferred: Roster lives in harness.roles, which itself
# imports from this module (config.loader). To avoid the cycle, the Roster
# class itself imports load_roster_files at module level; this module does
# not import Roster.

__all__ = [
    "SCHEMA_VERSION",
    "load_roster_files",
    "merge_local",
    "_build_agent",
]
