"""Phase-1 smoke tests: the skeleton imports + the CLI router works.

These tests don't exercise behavior (every subcommand body is a stub in
Phase 1). They DO catch the failure modes Phase 1 is responsible for
ruling out: import errors, missing __init__.py, broken pyproject.toml
package-find configuration.
"""
import subprocess
import sys

import pytest


def test_top_level_import():
    """The harness package itself imports cleanly."""
    import harness
    assert harness.__version__ == "0.1.0a0"


def test_subpackages_import():
    """Every subpackage from the design-doc §4 module map imports."""
    # If any of these fail, the directory tree or __init__.py wiring is wrong.
    import harness.agents          # noqa: F401
    import harness.config          # noqa: F401
    import harness.pipelines       # noqa: F401
    import harness.prompts         # noqa: F401
    import harness.steps           # noqa: F401
    import harness.telemetry       # noqa: F401
    import harness.workspace       # noqa: F401


def test_agent_base_types():
    """The agents/base.py type surface is in place per §5.1."""
    from harness.agents.base import (
        Agent, AgentInvocation, AgentResult, FailureReason, Prompt, UsageKind,
    )
    # Enums have all the values the doc declares.
    assert FailureReason.OK.value == "ok"
    assert FailureReason.SCOPE_VIOLATION.value == "scope_violation"
    assert UsageKind.IMPLEMENTER.value == "implementer"
    # Agent is abstract — instantiating it should fail.
    with pytest.raises(TypeError):
        Agent()  # type: ignore[abstract]


def test_cli_help_works():
    """`python -m harness --help` exits 0 (argparse handles --help)."""
    result = subprocess.run(
        [sys.executable, "-m", "harness", "--help"],
        capture_output=True,
        text=True,
        cwd="..",  # autogame/ root — harness/ must be importable from there
    )
    assert result.returncode == 0, f"--help failed: {result.stderr}"
    assert "supervisor" in result.stdout
    assert "backlog" in result.stdout
    assert "ticket" in result.stdout
    assert "subtask" in result.stdout


def test_cli_invalid_subcommand_exits_nonzero():
    """The CLI router rejects unknown subcommands. Phase-1 used to test
    'supervisor' exits non-zero with 'not implemented' — but once cli.py
    wires subcommand bodies (Phase 4), running 'supervisor' here would
    SPAWN A REAL SUPERVISOR for the duration of the test. That actually
    happened once and corrupted the working tree. Test the routing surface
    via a deliberately invalid subcommand instead."""
    result = subprocess.run(
        [sys.executable, "-m", "harness", "definitely_not_a_real_subcommand"],
        capture_output=True,
        text=True,
        cwd="..",
        timeout=15,
    )
    assert result.returncode != 0
    # argparse error has "invalid choice" + the bad subcommand name
    err = (result.stderr + result.stdout).lower()
    assert "invalid choice" in err or "error" in err
