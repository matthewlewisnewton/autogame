"""Config loader tests — field-level merge, schema_version, unknown-agent-name."""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from harness.config.loader import SCHEMA_VERSION, load_roster_files, merge_local


# ---------------------------------------------------- merge_local

class TestMergeLocal:
    def test_no_local_returns_base(self):
        base = {"a": 1, "b": {"c": 2}}
        assert merge_local(base, None) == base
        assert merge_local(base, {}) == {"a": 1, "b": {"c": 2}}

    def test_no_base_returns_local(self):
        local = {"a": 1}
        assert merge_local({}, local) == {"a": 1}

    def test_scalar_override(self):
        out = merge_local({"a": 1, "b": 2}, {"a": 99})
        assert out == {"a": 99, "b": 2}

    def test_nested_recursive_merge(self):
        """tunables.pipeline.* — overriding one nested field doesn't blow away siblings."""
        base = {"pipeline": {"server_timeout_s": 300, "client_timeout_s": 120}}
        local = {"pipeline": {"server_timeout_s": 600}}
        assert merge_local(base, local) == {
            "pipeline": {"server_timeout_s": 600, "client_timeout_s": 120}
        }

    def test_list_replace_whole(self):
        """Doc §6.6: lists REPLACE WHOLE, not append."""
        base = {"fallbacks": ["a", "b", "c"]}
        local = {"fallbacks": ["x"]}
        assert merge_local(base, local) == {"fallbacks": ["x"]}

    def test_adding_new_keys(self):
        out = merge_local({"a": 1}, {"b": 2})
        assert out == {"a": 1, "b": 2}

    def test_type_mismatch_local_wins(self):
        """If base says dict and local says scalar, local wins (defensive)."""
        out = merge_local({"a": {"x": 1}}, {"a": "scalar"})
        assert out == {"a": "scalar"}


# ---------------------------------------------------- load_roster_files

def _minimal_roster() -> dict:
    """Smallest valid roles.yaml — one agent, one role."""
    return {
        "schema_version": SCHEMA_VERSION,
        "tunables": {"max_iter": 5},
        "agents": {
            "qwen": {"backend": "qwen"},
        },
        "roles": {
            "implementer": {
                "primary": "qwen",
                "fallbacks": [],
                "timeout_s": 7200,
                "out_file": "qwen.txt",
                "prompt_template": "harness/prompts/implement.md",
                "acceptance": {"kind": "ok_rc"},
                "usage_kind": "implementer",
                "scope": {"allow": ["game/**"], "deny": []},
            },
        },
    }


def _write_yaml(path: Path, data: dict) -> None:
    path.write_text(yaml.safe_dump(data))


class TestLoadRosterFiles:
    def test_minimal_loads(self, tmp_path):
        path = tmp_path / "roles.yaml"
        _write_yaml(path, _minimal_roster())
        rf = load_roster_files(path)
        assert rf.tunables.max_iter == 5
        assert "qwen" in rf.agents
        assert "implementer" in rf.roles

    def test_missing_file_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_roster_files(tmp_path / "nope.yaml")

    def test_wrong_schema_version_raises(self, tmp_path):
        data = _minimal_roster()
        data["schema_version"] = 99
        path = tmp_path / "roles.yaml"
        _write_yaml(path, data)
        with pytest.raises(ValueError, match="schema_version"):
            load_roster_files(path)

    def test_missing_schema_version_raises(self, tmp_path):
        data = _minimal_roster()
        del data["schema_version"]
        path = tmp_path / "roles.yaml"
        _write_yaml(path, data)
        with pytest.raises(ValueError, match="schema_version"):
            load_roster_files(path)

    def test_local_overrides_base(self, tmp_path):
        base_path = tmp_path / "roles.yaml"
        local_path = tmp_path / "roles.local.yaml"
        _write_yaml(base_path, _minimal_roster())
        local = {
            "schema_version": SCHEMA_VERSION,
            "tunables": {"max_iter": 99},
        }
        _write_yaml(local_path, local)
        rf = load_roster_files(base_path, local_path)
        assert rf.tunables.max_iter == 99       # local won
        assert "qwen" in rf.agents              # base preserved

    def test_local_can_add_new_agent_and_role(self, tmp_path):
        base_path = tmp_path / "roles.yaml"
        local_path = tmp_path / "roles.local.yaml"
        _write_yaml(base_path, _minimal_roster())
        local = {
            "schema_version": SCHEMA_VERSION,
            "agents": {
                "claude": {"backend": "claude"},
            },
            "roles": {
                "rescue": {
                    "primary": "claude",
                    "fallbacks": [],
                    "timeout_s": 1800,
                    "out_file": "rescue.txt",
                    "prompt_template": "harness/prompts/rescue.md",
                    "acceptance": {"kind": "ok_rc"},
                    "usage_kind": "rescue",
                    "scope": {"allow": ["game/**"], "deny": []},
                },
            },
        }
        _write_yaml(local_path, local)
        rf = load_roster_files(base_path, local_path)
        # Both base and local agents present
        assert {"qwen", "claude"} <= set(rf.agents.keys())
        assert {"implementer", "rescue"} <= set(rf.roles.keys())
