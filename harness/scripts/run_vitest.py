#!/usr/bin/env python3
"""CLI wrapper around harness.steps.vitest_cleanup.run_vitest."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run vitest with process-group teardown")
    parser.add_argument("--cwd", type=Path, default=Path("game"))
    parser.add_argument("--timeout", type=int, required=True, help="Seconds before SIGKILL")
    parser.add_argument("vitest_args", nargs=argparse.REMAINDER,
                        help="Arguments passed to vitest (prefix with --)")
    args = parser.parse_args(argv)
    vitest_args = args.vitest_args
    if vitest_args[:1] == ["--"]:
        vitest_args = vitest_args[1:]
    if not vitest_args:
        parser.error("missing vitest arguments")

    repo_root = Path(__file__).resolve().parents[2]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    from harness.steps.vitest_cleanup import run_vitest

    return run_vitest(
        vitest_args,
        cwd=(repo_root / args.cwd).resolve(),
        timeout_s=args.timeout,
        stdout=sys.stdout.buffer,
    )


if __name__ == "__main__":
    raise SystemExit(main())
