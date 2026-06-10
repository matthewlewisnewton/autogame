"""Pydantic models for roles.yaml — the canonical schema.

The doc's §6.3 YAML example is the spec; this module is the source of
truth in code. Phase 1 of the migration plan said we'd add a small
`tools/dump-roles-schema.py` that asserts the doc and the code stay in
sync; that's deferred to Phase 4 / cutover prep.

Schema shape:
  schema_version: 1
  tunables: {...}              # config.tunables.Tunables
  agents:                       # named map (was YAML anchors in v1)
    qwen: {backend: qwen, ...}
    composer_fast_read: {backend: cursor, model: ..., writable: false}
    ...
  _role_defaults:               # per-family base; merged into roles via <<:
    qa: {...}
    review: {...}
  roles:
    implementer: {primary: <name>, fallbacks: [<name>, ...], ...}
    ...
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Discriminator, Field, Tag

from harness.config.tunables import Tunables


# ----- agents discriminated union ----------------------------------------- #

class _AgentSpecBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    backend: str  # discriminator


class QwenSpec(_AgentSpecBase):
    backend: Literal["qwen"]
    model: Optional[str] = None
    openai_logging: bool = True
    # Vision variant (handled by the loader's special case)
    is_vision: bool = False
    vision_model: str = "qwen3.6:27b-q8_0"
    vision_base_url: str = "http://localhost:11434/v1"
    vision_api_key: str = "ollama"


class CursorSpec(_AgentSpecBase):
    backend: Literal["cursor"]
    model: str
    writable: bool = False


class AgySpec(_AgentSpecBase):
    backend: Literal["agy"]
    model_label: str = "Gemini 3.5 Flash (High)"


class ClaudeSpec(_AgentSpecBase):
    backend: Literal["claude"]
    model: Optional[str] = None
    # claude CLI --effort level; None omits the flag (CLI default).
    effort: Optional[Literal["low", "medium", "high", "xhigh", "max"]] = None


def _agent_disc(value: Any) -> str:
    """Discriminator function: pick a class by the `backend:` field."""
    if isinstance(value, dict):
        return value.get("backend", "")
    return getattr(value, "backend", "")


AgentSpec = Annotated[
    Union[
        Annotated[QwenSpec, Tag("qwen")],
        Annotated[CursorSpec, Tag("cursor")],
        Annotated[AgySpec, Tag("agy")],
        Annotated[ClaudeSpec, Tag("claude")],
    ],
    Discriminator(_agent_disc),
]


# ----- acceptance criterion ---------------------------------------------- #

class AcceptanceSpec(BaseModel):
    """Shape used by Role.acceptance. Loader passes to
    prompts.acceptance.build_from_yaml."""
    model_config = ConfigDict(extra="allow")    # kind-specific kwargs land here
    kind: Literal["verdict", "review", "ok_rc"] = "ok_rc"


# ----- scope -------------------------------------------------------------- #

class ScopeSpec(BaseModel):
    """Allow/deny path-glob lists; consumed by git_helpers.scope_audit.
    Deny patterns win over allow patterns; missing matches imply deny."""
    model_config = ConfigDict(extra="forbid")
    allow: list[str] = Field(default_factory=list)
    deny: list[str] = Field(default_factory=list)


# ----- role --------------------------------------------------------------- #

class RoleSpec(BaseModel):
    """One role's full config. fields match the YAML example in doc §6.3
    verbatim. `primary` is a string name pointing at the `agents:` map;
    likewise `fallbacks: [name, ...]`."""
    model_config = ConfigDict(extra="forbid")
    primary: Optional[str] = None
    primary_by_difficulty: Optional[dict[str, str]] = None
    fallbacks: list[str] = Field(default_factory=list)
    fallbacks_by_difficulty: Optional[dict[str, list[str]]] = None
    timeout_s: int = 720
    out_file: str = "agent-out.txt"
    prompt_template: str = ""
    acceptance: AcceptanceSpec = Field(default_factory=AcceptanceSpec)
    usage_kind: str = "qa"
    scope: ScopeSpec = Field(default_factory=ScopeSpec)


# ----- top-level --------------------------------------------------------- #

class RosterFile(BaseModel):
    """Top-level shape for roles.yaml / roles.local.yaml.

    schema_version is required so we can introduce a v2 schema later
    without silently mis-loading old files; the loader rejects anything
    other than 1 today.
    """
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1]
    tunables: Tunables = Field(default_factory=Tunables)
    agents: dict[str, AgentSpec] = Field(default_factory=dict)
    role_defaults: dict[str, dict] = Field(default_factory=dict, alias="_role_defaults")
    roles: dict[str, RoleSpec] = Field(default_factory=dict)


__all__ = [
    "AcceptanceSpec",
    "AgentSpec",
    "AgySpec",
    "ClaudeSpec",
    "CursorSpec",
    "QwenSpec",
    "RoleSpec",
    "RosterFile",
    "ScopeSpec",
]
