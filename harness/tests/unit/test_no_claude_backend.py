"""Guard: claude is never used by a DEFAULT harness role (cost — Anthropic
always-on use requires the API, which isn't competitive with the cursor coding
plans).

claude IS available as an agent again, but only so the parallel factory can opt
into it as an explicit medium/hard implementer at concurrency 1 (via a per-worker
roles.local.yaml override). The base roles.yaml must still route every always-on
role (implementer default, qa, review, decomposer, committer, split, repair) to
non-claude agents — so claude can't silently creep into the always-on path via a
future edit. This test asserts that invariant on the REAL roles.yaml.
"""
from __future__ import annotations

from pathlib import Path

import harness
from harness.roles import Roster

_ROLES_YAML = Path(harness.__file__).resolve().parent / "roles.yaml"

# Every role family declared in roles.yaml (factory overrides implementer at
# runtime; the BASE roster must never resolve any of these to claude).
_ROLE_NAMES = ("implementer", "qa:code", "qa:visual", "committer",
               "vision_feedback", "decomposer", "review", "split", "repair")


def _agents_for(roster: Roster, role_name: str):
    """All agents (primary + fallbacks) a role can resolve to, across the
    difficulties a primary_by_difficulty role might use."""
    seen = []
    for diff in (None, "easy", "medium", "hard"):
        try:
            role = roster.role(role_name, difficulty=diff)
        except (KeyError, TypeError, ValueError):
            continue
        for agent in [role.primary, *role.fallbacks]:
            if agent not in seen:
                seen.append(agent)
    return seen


def test_no_default_role_routes_to_claude():
    roster = Roster.load(_ROLES_YAML, None)
    for role_name in _ROLE_NAMES:
        for agent in _agents_for(roster, role_name):
            assert not agent.name.startswith("claude/"), \
                f"default role '{role_name}' routes to claude: {agent.name}"


def test_recovery_roles_route_to_composer():
    roster = Roster.load(_ROLES_YAML, None)
    # repair (self-healing) and split (restructure) must not be claude.
    for role_name in ("repair", "split"):
        role = roster.role(role_name)
        assert "claude" not in role.primary.name.lower(), \
            f"role '{role_name}' primary is claude: {role.primary.name}"


def test_claude_agent_is_available_for_the_factory():
    """The factory routes medium/hard tickets to `claude`; the agent must exist
    in the roster so the per-worker override can resolve it."""
    roster = Roster.load(_ROLES_YAML, None)
    assert "claude" in roster.agents
    assert roster.agents["claude"].name.startswith("claude/")
