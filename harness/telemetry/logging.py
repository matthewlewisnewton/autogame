"""Pipeline-scoped logging — ports `exec > >(tee -a) 2>&1` pattern."""
from __future__ import annotations

import datetime as _dt
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import IO, Iterator


def log(message: str) -> None:
    """Print a timestamped line. Mirrors lib.sh::log."""
    ts = _dt.datetime.now().strftime("%F %T")
    print(f"[{ts}] {message}", flush=True)


class _Tee:
    def __init__(self, primary: IO[str], mirror: IO[str]):
        self._primary = primary
        self._mirror = mirror

    def write(self, data: str) -> int:
        n = self._primary.write(data)
        try:
            self._mirror.write(data)
            self._mirror.flush()
        except (OSError, ValueError):
            pass
        return n

    def flush(self) -> None:
        try: self._primary.flush()
        except (OSError, ValueError): pass
        try: self._mirror.flush()
        except (OSError, ValueError): pass

    def __getattr__(self, name: str):
        return getattr(self._primary, name)


@contextmanager
def tee_pipeline_log(path: Path) -> Iterator[None]:
    """Replace sys.stdout/sys.stderr with tees that ALSO write to path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    mirror = path.open("a", encoding="utf-8")
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout = _Tee(old_stdout, mirror)
    sys.stderr = _Tee(old_stderr, mirror)
    try:
        yield
    finally:
        try:
            mirror.flush(); mirror.close()
        except OSError:
            pass
        sys.stdout = old_stdout
        sys.stderr = old_stderr


__all__ = ["log", "tee_pipeline_log"]
