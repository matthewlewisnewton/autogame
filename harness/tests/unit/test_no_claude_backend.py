"""Guard: claude is never used by a DEFAULT harness role (cost — Anthropic
always-on use requires the API, which isn't competitive with the cursor coding
plans).

claude IS available as an agent again, but only so the parallel factory can opt
into it as an explicit medium/hard implementer at concurrency 1 (via a per-worker
roles.local.yaml override). The base roles.yaml must still route every always-on
role PRIMARY (implementer default, qa, decomposer, committer, split, repair) to
non-claude agents — so claude can't silently creep into the always-on path via a
future edit.

EXCEPTION: the `review` role may use claude as a *fallback* (never primary).
claude (opus-4.8) is the chosen reviewer-of-last-resort when the primary review
agent fails — notably gpt-5.5 fast-failing on quota — accepting the Anthropic
cost for that degraded path only. This test asserts both invariants on the REAL
roles.yaml.
"""
from __future__ import annotations

from pathlib import Path

import harness
from harness.roles import Roster

_ROLES_YAML = Path(harness.__file__).resolve().parent / "roles.yaml"

# Always-on role families that must NEVER resolve to claude on ANY tier
# (primary or fallback). `review`, `split`, and `repair` are intentionally
# excluded — they may fall back to claude (asserted separately below) — but their
# PRIMARIES are still guarded (see test_recovery_roles_route_to_composer).
_ROLE_NAMES = ("implementer", "qa:code", "qa:visual", "committer",
               "vision_feedback", "decomposer")


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


def test_review_primary_is_non_claude_but_fallback_is_claude():
    """review may degrade to claude, but only as a fallback — its primary (per
    difficulty) must stay non-claude (always-on cost guard), and claude must
    actually be present in the fallback chain (the intended quota-degraded path)."""
    roster = Roster.load(_ROLES_YAML, None)
    for diff in ("easy", "medium", "hard"):
        role = roster.role("review", difficulty=diff)
        assert not role.primary.name.startswith("claude/"), \
            f"review primary for {diff!r} must not be claude: {role.primary.name}"
        assert any(a.name.startswith("claude/") for a in role.fallbacks), \
            f"review for {diff!r} should fall back to claude; got {[a.name for a in role.fallbacks]}"


def test_recovery_roles_primary_composer_fallback_claude():
    """repair (self-healing) and split (restructure) keep a non-claude PRIMARY
    (composer — always-on cost guard) but now fall back to claude so they survive
    a composer quota outage."""
    roster = Roster.load(_ROLES_YAML, None)
    for role_name in ("repair", "split"):
        role = roster.role(role_name)
        assert "claude" not in role.primary.name.lower(), \
            f"role '{role_name}' primary is claude: {role.primary.name}"
        assert any(a.name.startswith("claude/") for a in role.fallbacks), \
            f"role '{role_name}' should fall back to claude; got {[a.name for a in role.fallbacks]}"


def test_claude_agent_is_available_for_the_factory():
    """The factory routes medium/hard tickets to `claude`; the agent must exist
    in the roster so the per-worker override can resolve it."""
    roster = Roster.load(_ROLES_YAML, None)
    assert "claude" in roster.agents
    assert roster.agents["claude"].name.startswith("claude/")
