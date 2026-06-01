"""Guard: the Claude CLI is disabled in the harness (cost — Anthropic always-on
use requires the API, which isn't competitive with the cursor coding plans).

The `claude` agent was removed from roles.yaml and its roles re-routed to
composer-2.5. This test loads the REAL roles.yaml and asserts no role resolves
to a claude-backed agent, so claude can't silently creep back via a future edit.
Re-enabling claude is therefore a deliberate act (re-add the agent + update this
test). The ClaudeAgent backend class itself is intentionally left in place
(dormant) for easy reversibility.
"""
from __future__ import annotations

from pathlib import Path

import harness
from harness.agents.claude import ClaudeAgent
from harness.roles import Roster

_ROLES_YAML = Path(harness.__file__).resolve().parent / "roles.yaml"


def test_no_claude_agent_in_real_roster():
    roster = Roster.load(_ROLES_YAML, None)
    for name, agent in roster.agents.items():
        assert not isinstance(agent, ClaudeAgent), f"agent '{name}' is claude-backed"
        assert not agent.name.startswith("claude/"), f"agent '{name}' resolves to claude"


def test_recovery_roles_route_to_composer():
    roster = Roster.load(_ROLES_YAML, None)
    # repair (self-healing) and split (restructure) must not be claude.
    for role_name in ("repair", "split"):
        role = roster.role(role_name)
        assert "claude" not in role.primary.name.lower(), \
            f"role '{role_name}' primary is claude: {role.primary.name}"
