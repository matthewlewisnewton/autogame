"""qa — invoke qa:code / qa:visual role + parse the verdict."""
from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING, Literal, Optional

from harness.telemetry.logging import log

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


_VERDICT_RE = re.compile(r"^VERDICT:\s*(PASS|FAIL)\b", re.MULTILINE)


def qa(role: "Role", *, workspace, ticket_file: Path, artifacts_dir: Path,
       telemetry=None) -> "ChainResult":
    log(f"[qa] {role.name} running...")
    return role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "ARTIFACTS_DIR": str(artifacts_dir),
        },
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
    )


def parse_verdict(stdout: str) -> Optional[Literal["PASS", "FAIL"]]:
    m = _VERDICT_RE.search(stdout or "")
    if not m:
        return None
    return m.group(1)  # type: ignore[return-value]


__all__ = ["parse_verdict", "qa"]
