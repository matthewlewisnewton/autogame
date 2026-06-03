"""flock-based mutex for shared SYNCHRONOUS resources.

Some resources the factory touches are singletons that cannot be used by two
runners at once — the first is the single **Blender** instance (one app, one
socket at :9876). Unlike qwen (one *agent*, serialized by that agent's
max_concurrency=1), Blender can be reached by several different agents AND by the
operator's own interactive session, so an agent-level cap can't protect it.

`held(resource)` is a cross-process mutex: it takes an exclusive `fcntl.flock`
on `<main>/harness/tmp/locks/<resource>.lock`. The lock file lives in the MAIN
checkout (derived from the shared progress dir), NOT a per-worktree path, so every
parallel worker (each in its own worktree) and the operator session contend on the
SAME file. The OS releases the lock automatically if the holder exits or crashes,
so a dead worker can never wedge the resource.

Usage:
    with held("blender"):
        ... drive Blender ...

This is deliberately generic — add new shared resources by passing a different
name; nothing here is Blender-specific.
"""
from __future__ import annotations

import os
import re
import sys
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

try:
    import fcntl  # POSIX only; the factory runs on Linux
except ImportError:  # pragma: no cover
    fcntl = None  # type: ignore

from harness.telemetry.logging import log
from harness.telemetry.progress import progress_dir


def lock_path(resource: str) -> Path:
    """Shared lock file for `resource`, pinned to the main checkout so all
    worktrees + the operator session use one file. `progress_dir()` already
    resolves to `<main>/harness/progress` for workers (via HARNESS_PROGRESS_DIR)
    and module-relative for the operator — both land in the same `<main>/harness`."""
    d = progress_dir().parent / "tmp" / "locks"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{resource}.lock"


def _default_holder() -> str:
    """A compact, human-readable identity for whoever takes a lock — derived from
    this process's argv so no caller needs to plumb a label through. A factory
    worker shows as `worker <ticket> --agent <a>`, the operator's hand-hold as
    `lock <resource>`, etc. Falls back to the process name."""
    argv = sys.argv[1:]
    if argv:
        who = " ".join(argv)
    else:
        who = os.path.basename(sys.argv[0]) if sys.argv else "?"
    return who[:120]


def read_holder(resource: str) -> Optional[str]:
    """The recorded holder line for `resource`'s lock file (the metadata the
    current/last holder wrote), or None if unreadable/empty. This is advisory:
    the OS flock is the real mutex; this just records WHO for visibility, and the
    line may be stale if the holder crashed (the OS will have freed the flock)."""
    try:
        line = lock_path(resource).read_text(errors="replace").strip()
    except OSError:
        return None
    return line or None


def is_held(resource: str) -> bool:
    """True if `resource`'s flock is currently held by SOME process. Probes with a
    non-blocking flock on a separate fd; acquiring means it was free (we release
    immediately). Never blocks. Best-effort (False if fcntl/file unavailable)."""
    if fcntl is None:  # pragma: no cover
        return False
    path = lock_path(resource)
    if not path.exists():
        return False
    try:
        probe = open(path, "a+")
    except OSError:
        return False
    try:
        fcntl.flock(probe.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(probe.fileno(), fcntl.LOCK_UN)
        return False  # we got it → nobody held it
    except OSError:
        return True   # someone else holds it
    finally:
        probe.close()


def lock_status() -> list[dict]:
    """Snapshot every known lock file: its resource name, whether it's currently
    held, and the recorded holder metadata. For the `harness locks` inspector."""
    out: list[dict] = []
    try:
        d = progress_dir().parent / "tmp" / "locks"
        files = sorted(d.glob("*.lock"))
    except OSError:
        files = []
    for p in files:
        resource = p.stem
        out.append({"resource": resource,
                    "held": is_held(resource),
                    "holder": read_holder(resource) or "(no record)"})
    return out


@contextmanager
def held(resource: str, *, timeout: Optional[float] = None,
         poll: float = 1.0, holder: Optional[str] = None) -> Iterator[None]:
    """Hold an exclusive lock on `resource` for the duration of the block.

    Blocks until the lock is free. If `timeout` (seconds) is given and elapses
    while waiting, raises TimeoutError (callers can treat that as "resource busy,
    requeue"). If fcntl is unavailable, degrades to a no-op (best-effort).

    `holder` is a label recorded in the lock file (and logged to anyone waiting)
    so it's clear WHO holds the resource; it defaults to this process's argv."""
    if fcntl is None:  # pragma: no cover
        log(f"[lock] fcntl unavailable — '{resource}' NOT serialized")
        yield
        return
    who = holder or _default_holder()
    path = lock_path(resource)
    f = open(path, "a+")
    waited = False
    acquired = False
    deadline = None if timeout is None else time.monotonic() + timeout
    try:
        while True:
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                acquired = True
                break
            except OSError:
                if not waited:
                    other = read_holder(resource) or "(unknown — no record)"
                    log(f"[lock] '{resource}' busy, waiting — held by {other}")
                    waited = True
                if deadline is not None and time.monotonic() >= deadline:
                    raise TimeoutError(f"resource '{resource}' lock not acquired within {timeout}s")
                time.sleep(poll)
        try:
            f.seek(0)
            f.truncate()
            f.write(f"pid={os.getpid()} who={who!r} since={datetime.now().isoformat(timespec='seconds')}\n")
            f.flush()
        except OSError:
            pass
        log(f"[lock] acquired '{resource}' (pid={os.getpid()}, {who})"
            + (" — after waiting" if waited else ""))
        yield
    finally:
        if acquired:
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
            log(f"[lock] released '{resource}' (pid={os.getpid()})")
        f.close()


# A ticket declares it needs a shared resource with a line in its ticket.md, e.g.
#   ## Resource: blender
# (also accepts "Resource Lock: blender", with or without leading #'s).
_RESOURCE_RE = re.compile(r"^\s*#*\s*resource(?:\s*lock)?\s*:\s*([a-z0-9_-]+)",
                          re.IGNORECASE | re.MULTILINE)


def resource_for_ticket(tdir) -> Optional[str]:
    """Return the shared resource a ticket needs (from a `Resource:` line in its
    ticket.md), or None. Both the dispatcher and the worker use this so they agree
    on which tickets must serialize on a resource."""
    try:
        text = (Path(tdir) / "ticket.md").read_text(errors="replace")
    except OSError:
        return None
    m = _RESOURCE_RE.search(text)
    return m.group(1).lower() if m else None


__all__ = ["held", "lock_path", "resource_for_ticket",
           "read_holder", "is_held", "lock_status"]
