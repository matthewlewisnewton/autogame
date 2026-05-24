"""coverage_run — vitest --coverage --changed BASE_REF (visibility-only)."""
from __future__ import annotations

import shutil
from pathlib import Path

from harness.config.tunables import PipelineTunables
from harness.steps.vitest_cleanup import run_vitest
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event


_DEFAULT_INCLUDES = (
    "server/index.js",
    "client/cards.js",
    "client/collision.js",
    "client/hand.js",
    "client/delta.js",
)


def coverage_run(workspace, base_ref: str, coverage_dir: Path,
                 *, tunables: PipelineTunables, ticket_name: str,
                 round_n: int) -> Path:
    coverage_dir = Path(coverage_dir)
    coverage_dir.mkdir(parents=True, exist_ok=True)
    out_path = coverage_dir / "coverage.log"
    log(f"[coverage] running coverage on changed files (baseline {base_ref})...")
    emit_progress_event("coverage_start", {
        "ticket": ticket_name, "round": round_n, "baseline": base_ref,
    })
    args = [
        "run", "--coverage",
    ]
    for inc in _DEFAULT_INCLUDES:
        args += ["--coverage.include", inc]
    for thr in ("statements", "branches", "functions", "lines"):
        args += [f"--coverage.thresholds.{thr}", "0"]
    args += ["--changed", base_ref]
    with out_path.open("wb") as f:
        try:
            run_vitest(
                args,
                cwd=Path(tunables.check_cwd),
                timeout_s=tunables.coverage_timeout_s,
                stdout=f,
            )
        except FileNotFoundError as e:
            f.write(f"[coverage] failed to spawn: {e}\n".encode())
    return out_path


def copy_coverage_into_artifacts(coverage_dir: Path, artifacts_dir: Path) -> None:
    """Per gpt R3: review.md prompt expects coverage.log in ARTIFACTS_DIR."""
    src = Path(coverage_dir) / "coverage.log"
    if src.exists():
        shutil.copy2(src, Path(artifacts_dir) / "coverage.log")


__all__ = ["copy_coverage_into_artifacts", "coverage_run"]
