"""worker subcommand: parsing + implementer-override writer (parallel-factory)."""
from __future__ import annotations

from pathlib import Path

import yaml

from harness.cli import _build_parser, _write_implementer_override


def test_worker_subcommand_parses():
    args = _build_parser().parse_args(["worker", "121-foo", "--agent", "composer_write"])
    assert args.cmd == "worker"
    assert args.name == "121-foo"
    assert args.agent == "composer_write"


def test_override_writer_fresh(tmp_path):
    _write_implementer_override(tmp_path, "composer_write")
    data = yaml.safe_load((tmp_path / "harness/roles.local.yaml").read_text())
    assert data == {"roles": {"implementer": {"primary": "composer_write"}}}


def test_override_writer_merges_existing(tmp_path):
    local = tmp_path / "harness/roles.local.yaml"
    local.parent.mkdir(parents=True)
    local.write_text(yaml.safe_dump({
        "tunables": {"max_iter": 3},
        "roles": {"qa:code": {"primary": "qwen"}},
    }))
    _write_implementer_override(tmp_path, "gpt5_extra_write")
    data = yaml.safe_load(local.read_text())
    # existing keys preserved, implementer.primary added
    assert data["tunables"]["max_iter"] == 3
    assert data["roles"]["qa:code"]["primary"] == "qwen"
    assert data["roles"]["implementer"]["primary"] == "gpt5_extra_write"
