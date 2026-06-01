"""AgentRegistry: eligibility, concurrency caps, health, persistence."""
from __future__ import annotations

from harness.dispatch.registry import AgentRegistry, AgentSpec


def _registry(health_file=None):
    specs = [
        AgentSpec("qwen", max_concurrency=1, eligible=frozenset({"easy", "medium"})),
        AgentSpec("composer", max_concurrency=3, eligible=frozenset({"easy", "medium", "hard"})),
        AgentSpec("gpt5_extra", max_concurrency=3, eligible=frozenset({"hard"})),
    ]
    preference = {
        "easy": ["qwen", "composer"],
        "medium": ["composer", "qwen"],   # composer primary; qwen overflow
        "hard": ["gpt5_extra", "composer"],
    }
    return AgentRegistry(specs, preference, health_file=health_file)


def test_selection_follows_preference():
    r = _registry()
    assert r.select_and_acquire("easy") == "qwen"
    assert r.select_and_acquire("hard") == "gpt5_extra"


def test_qwen_cap_of_one_then_overflows():
    r = _registry()
    # medium prefers composer, but force qwen busy first via easy
    assert r.select_and_acquire("easy") == "qwen"      # qwen now at cap 1
    # a medium ticket: composer is first pref and free → composer
    assert r.select_and_acquire("medium") == "composer"
    # exhaust composer's 3 slots
    assert r.select_and_acquire("medium") == "composer"
    assert r.select_and_acquire("medium") == "composer"
    # composer full (3) AND qwen full (1) → no agent for a 4th medium
    assert r.select_and_acquire("medium") is None


def test_release_frees_capacity():
    r = _registry()
    assert r.select_and_acquire("easy") == "qwen"
    assert r.select_and_acquire("medium") in ("composer",)  # qwen busy
    r.release("qwen")
    # qwen free again; an easy ticket goes back to qwen (first pref)
    assert r.select_and_acquire("easy") == "qwen"


def test_disabled_agent_is_skipped():
    r = _registry()
    r.disable("qwen", reason="quota")
    # easy prefers qwen, but it's disabled → falls through to composer
    assert r.select_and_acquire("easy") == "composer"
    assert "qwen" in r.disabled_agents()
    r.enable("qwen")
    assert r.select_and_acquire("easy") == "qwen"


def test_no_eligible_agent_returns_none():
    r = _registry()
    # disable both hard-eligible agents
    r.disable("gpt5_extra")
    r.disable("composer")
    assert r.select_and_acquire("hard") is None


def test_health_persists_across_restart(tmp_path):
    hf = tmp_path / "agents_health.json"
    r1 = _registry(health_file=hf)
    r1.disable("composer", reason="rate limit")
    # new registry loading the same file: composer stays disabled
    r2 = _registry(health_file=hf)
    assert "composer" in r2.disabled_agents()
    r2.enable("composer")
    r3 = _registry(health_file=hf)
    assert "composer" not in r3.disabled_agents()
