"""Factory launcher — assembles and runs the parallel dispatcher.

Wires BeadsQueue + AgentRegistry + Dispatcher + MergeQueue into one process
(the sole beads writer, worktree creator, and merge author), reconciles state
orphaned by a previous crash, and runs the loop. Runtime config (worker count,
agent caps/eligibility, the cost-ordered assignment, GPU reservation) is read
from harness/factory.yaml at startup (see load_factory_config); the DEFAULT_*
constants below are the fallback when that file is absent.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from harness.beads import BeadsQueue
from harness.dispatch.dispatcher import Dispatcher
from harness.dispatch.merge_queue import MERGED_UNCLOSED, MergeQueue
from harness.dispatch.registry import AgentRegistry, AgentSpec
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.ports import allocate_pool
from harness.workspace.repo import Repo

DEFAULT_SPECS = [
    AgentSpec("qwen", max_concurrency=1, eligible=frozenset({"easy", "medium"})),
    AgentSpec("composer_write", max_concurrency=3,
              eligible=frozenset({"easy", "medium", "hard"})),
    AgentSpec("gpt5_extra_write", max_concurrency=1, eligible=frozenset({"hard"})),
    # claude opted in for medium/hard only, up to 2 concurrent implementers.
    AgentSpec("claude", max_concurrency=2, eligible=frozenset({"medium", "hard"})),
]
# Single global priority order, cheapest first. Eligibility (above) decides which
# difficulties each agent can take; the dispatcher walks this order and picks the
# first qualifying, free agent. So qwen (local/free) is preferred wherever it's
# eligible (easy, medium), then composer (cheap, all lanes), then the expensive
# remotes claude and gpt-5.5 — reached only when the cheaper agents are saturated.
DEFAULT_ORDER = ["qwen", "composer_write", "claude", "gpt5_extra_write"]
DEFAULT_WORKERS = 5


@dataclass
class FactoryConfig:
    workers: int = DEFAULT_WORKERS
    reserve_qwen: bool = True
    order: list[str] = field(default_factory=lambda: list(DEFAULT_ORDER))
    specs: list[AgentSpec] = field(default_factory=lambda: list(DEFAULT_SPECS))


def _merge_factory_data(base: dict, override: dict) -> dict:
    """Shallow-merge override onto base, but deep-merge the per-agent dicts so a
    local override can tweak one agent's cap without redeclaring all of them."""
    out = dict(base)
    for k, v in override.items():
        if k == "agents" and isinstance(v, dict) and isinstance(out.get("agents"), dict):
            agents = dict(out["agents"])
            for name, spec in v.items():
                agents[name] = {**agents.get(name, {}), **(spec or {})}
            out["agents"] = agents
        else:
            out[k] = v
    return out


def load_factory_config(main_root) -> FactoryConfig:
    """Read harness/factory.yaml (+ optional factory.local.yaml override) for the
    factory's runtime config. Missing/unreadable → hardcoded DEFAULT_* fallback,
    so the factory always launches."""
    import yaml
    main_root = Path(main_root)
    data: dict = {}
    for p in (main_root / "harness" / "factory.yaml",
              main_root / "harness" / "factory.local.yaml"):
        if not p.exists():
            continue
        try:
            loaded = yaml.safe_load(p.read_text()) or {}
        except yaml.YAMLError as e:
            log(f"[factory] config: ignoring malformed {p.name}: {e!r}")
            continue
        data = _merge_factory_data(data, loaded)
    if not data:
        return FactoryConfig()
    try:
        agents = data.get("agents") or {}
        specs = [AgentSpec(name, int(a["max_concurrency"]), frozenset(a["eligible"]))
                 for name, a in agents.items()]
        return FactoryConfig(
            workers=int(data.get("workers", DEFAULT_WORKERS)),
            reserve_qwen=bool(data.get("reserve_qwen", True)),
            order=list(data.get("order") or DEFAULT_ORDER),
            specs=specs or list(DEFAULT_SPECS),
        )
    except (KeyError, TypeError, ValueError) as e:
        log(f"[factory] config: invalid factory.yaml ({e!r}); using defaults")
        return FactoryConfig()


def default_registry(health_file: Path) -> AgentRegistry:
    return AgentRegistry(DEFAULT_SPECS, DEFAULT_ORDER, health_file=health_file)


def _kill_stray_workers(*, wait_s: float = 5.0) -> None:
    """A crashed/restarted dispatcher leaves its `harness worker` subprocesses
    alive (spawned with start_new_session=True). Kill them BEFORE requeuing their
    beads and cleaning worktrees — a survivor would double-run a ticket, and a
    worker still dying (mid pnpm-install/git) can recreate its worktree dir right
    after we clean it. So SIGTERM, then WAIT for them to actually exit, SIGKILL
    any stragglers. Best-effort; the dispatcher itself is `harness factory`, not
    `harness worker`, so this won't self-kill."""
    import time
    try:
        subprocess.run(["pkill", "-TERM", "-f", "harness worker"],
                       check=False, capture_output=True)
    except Exception as e:
        log(f"[factory] reconcile: pkill stray workers failed: {e!r}")
        return
    deadline = time.monotonic() + wait_s
    while time.monotonic() < deadline:
        if subprocess.run(["pgrep", "-f", "harness worker"],
                          capture_output=True).returncode != 0:
            return  # all gone
        time.sleep(0.5)
    # stragglers: force-kill and give the OS a moment to reap
    subprocess.run(["pkill", "-KILL", "-f", "harness worker"],
                   check=False, capture_output=True)
    time.sleep(0.5)


def _read_merged_unclosed(root: Path) -> set[str]:
    try:
        text = (Path(root) / MERGED_UNCLOSED).read_text()
    except OSError:
        return set()
    return {ln.strip() for ln in text.splitlines() if ln.strip()}


def clean_orphan_worktrees(main_repo: Repo) -> int:
    """Remove every `.autogame-worktrees/*` worktree and `auto/*` branch.

    At dispatcher startup nothing is live, so all of these are orphans from a
    prior run. `git worktree prune` alone does NOT help — it only unregisters
    worktrees whose directory is already gone, so a leftover dir would make the
    next `worktree add` at that path fail and the reset ticket could never be
    re-worked. Removing the dirs here makes a restart a clean reset. Returns the
    number of worktrees removed."""
    removed = 0
    try:
        listing = main_repo.run_git("worktree", "list", "--porcelain")
    except Exception as e:
        log(f"[factory] reconcile: could not list worktrees: {e!r}")
        listing = ""
    for line in listing.splitlines():
        if line.startswith("worktree ") and ".autogame-worktrees" in line:
            path = line[len("worktree "):].strip()
            try:
                main_repo.run_git("worktree", "remove", "--force", path,
                                  check=False, capture=False)
                removed += 1
            except Exception as e:
                log(f"[factory] reconcile: worktree remove {path} failed: {e!r}")
    try:
        main_repo.run_git("worktree", "prune", check=False, capture=False)
    except Exception:
        pass
    try:
        branches = main_repo.run_git("branch", "--list", "auto/*")
    except Exception:
        branches = ""
    for b in branches.splitlines():
        name = b.replace("*", "").strip()
        if name.startswith("auto/"):
            try:
                main_repo.run_git("branch", "-D", name, check=False, capture=False)
            except Exception:
                pass
    return removed


def reconcile(queue: BeadsQueue, main_repo: Repo) -> int:
    """On startup no workers should be running, so any `in_progress` bead is
    orphaned from a previous run. Reset it to ready — EXCEPT beads recorded as
    merged-but-unclosed (already on main): those get closed, not re-run. Also
    kills stray detached workers first and prunes stale worktrees. Returns the
    number of orphans reset to ready."""
    _kill_stray_workers()
    merged_unclosed = _read_merged_unclosed(main_repo.root)
    try:
        orphans = queue.in_progress()
    except Exception as e:
        log(f"[factory] reconcile: could not list in_progress beads: {e!r}")
        orphans = []
    reset = 0
    for issue in orphans:
        iid = issue["id"]
        label = issue.get("title", iid)
        if iid in merged_unclosed:
            log(f"[factory] reconcile: {label} was merged but unclosed — closing")
            try:
                queue.close(iid, "merged to main (recovered by reconcile)")
            except Exception as e:
                log(f"[factory] reconcile: close of merged {iid} failed: {e!r}")
            continue
        log(f"[factory] reconcile: resetting orphaned in_progress {label}")
        try:
            queue.requeue(iid, note="reconcile: orphaned in_progress on dispatcher startup")
            reset += 1
        except Exception as e:
            log(f"[factory] reconcile: requeue failed for {iid}: {e!r}")
    if merged_unclosed:
        try:
            (Path(main_repo.root) / MERGED_UNCLOSED).unlink()
        except OSError:
            pass
    n_wt = clean_orphan_worktrees(main_repo)
    if n_wt:
        log(f"[factory] reconcile: cleaned {n_wt} orphaned worktree(s)")
    return reset


def build_factory(main_root, *, workers: Optional[int] = None,
                  health_file: Optional[Path] = None, tick_seconds: float = 5.0,
                  config: Optional[FactoryConfig] = None):
    """Assemble the factory from harness/factory.yaml (caps, order, reserve_qwen,
    workers). `workers`, if given, overrides the config's worker count (e.g. the
    CLI `--workers` flag)."""
    main_root = Path(main_root)
    cfg = config if config is not None else load_factory_config(main_root)
    n_workers = workers if workers is not None else cfg.workers
    main_repo = Repo(root=main_root)
    queue = BeadsQueue(main_root)
    registry = AgentRegistry(
        cfg.specs, cfg.order,
        health_file=health_file or main_root / "harness" / "agents_health.json")
    mq = MergeQueue(main_repo=main_repo, queue=queue)
    disp = Dispatcher(
        queue=queue, registry=registry, main_repo=main_repo,
        ports_pool=allocate_pool(n_workers),
        on_pass=mq.enqueue, merge_drain=mq.drain_one,
        tick_seconds=tick_seconds,
        reserve_qwen=cfg.reserve_qwen,
    )
    return disp, mq, queue, registry


def run_factory(main_root, *, workers: Optional[int] = None, max_idle_ticks: int = 0,
                **kw) -> int:
    from harness.telemetry import progress_server
    disp, mq, queue, registry = build_factory(main_root, workers=workers, **kw)
    n_workers = len(disp.ports_pool)
    n = reconcile(queue, disp.main_repo)
    log(f"[factory] reconciled {n} orphaned ticket(s); launching {n_workers} workers")
    disabled = registry.disabled_agents()
    if disabled:
        log(f"[factory] NOTE: agents disabled (need `harness factory --enable <agent>`): {disabled}")
    progress_server.start_if_needed()
    emit_progress_event("factory_start", {"workers": n_workers, "disabled_agents": disabled})
    disp.run(max_idle_ticks=max_idle_ticks)
    return 0


__all__ = ["run_factory", "build_factory", "reconcile", "default_registry",
           "clean_orphan_worktrees", "load_factory_config", "FactoryConfig",
           "DEFAULT_SPECS", "DEFAULT_ORDER"]
