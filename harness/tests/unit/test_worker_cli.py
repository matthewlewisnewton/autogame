"""worker subcommand: parsing + implementer-override writer (parallel-factory)."""
from __future__ import annotations

from pathlib import Path

import yaml

from harness.cli import _build_parser, _write_worker_role_overrides


def test_worker_subcommand_parses():
    args = _build_parser().parse_args(["worker", "121-foo", "--agent", "composer_write"])
    assert args.cmd == "worker"
    assert args.name == "121-foo"
    assert args.agent == "composer_write"


def test_override_writer_fresh(tmp_path):
    _write_worker_role_overrides(tmp_path, "composer_write")
    data = yaml.safe_load((tmp_path / "harness/roles.local.yaml").read_text())
    # the worker owns planning, implementation, AND sub-ticket review
    assert data == {"roles": {
        "implementer": {"primary": "composer_write"},
        "decomposer": {"primary": "composer_write"},
        "qa:code": {"primary": "composer_write"},
        "qa:visual": {"primary": "composer_write"},
    }}


def test_override_writer_merges_existing(tmp_path):
    local = tmp_path / "harness/roles.local.yaml"
    local.parent.mkdir(parents=True)
    local.write_text(yaml.safe_dump({
        "tunables": {"max_iter": 3},
        "roles": {"committer": {"primary": "qwen"}},
    }))
    _write_worker_role_overrides(tmp_path, "gpt5_extra_write")
    data = yaml.safe_load(local.read_text())
    # existing keys preserved; all four authoring roles overridden to the agent
    assert data["tunables"]["max_iter"] == 3
    assert data["roles"]["committer"]["primary"] == "qwen"
    for role in ("implementer", "decomposer", "qa:code", "qa:visual"):
        assert data["roles"][role]["primary"] == "gpt5_extra_write"
