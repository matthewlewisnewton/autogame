"""ticket() — port of run_ticket.sh per design doc §8.2.

Returns:
   0 = ticket complete
   1 = ticket genuinely incomplete
   2 = harness/tool failure (escalate)
   3 = ticket split — backlog re-scans
"""
from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from harness.config.tunables import Tunables, get_tunables
from harness.pipelines.subtask import SubtaskContext, subtask
from harness.roles import Roster
from harness.steps.append_review import append_review_pointer, put_review_fb
from harness.steps.capture_run import capture_run
from harness.steps.coverage import copy_coverage_into_artifacts, coverage_run
from harness.steps.decompose import decompose, list_subticket_dirs
from harness.steps.finalize import FinalizeResult, finalize
from harness.steps.protect_review import protect_review, verify_reviews
from harness.steps.rescue import rescue
from harness.steps.review import recover_review_files
from harness.steps.split import split
from harness.telemetry.logging import log, tee_pipeline_log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.repo import Repo


_DIFFICULTY_RE = re.compile(r"^\s*##?\s*Difficulty\s*:\s*(\w+)\s*$", re.MULTILINE | re.IGNORECASE)
_REVIEW_VERDICT_RE = re.compile(r"^VERDICT:\s*(PASS|APPROVE|FAIL|REJECT)\b", re.MULTILINE)


def _difficulty(ticket_file: Path) -> str:
    try:
        m = _DIFFICULTY_RE.search(ticket_file.read_text())
    except OSError:
        return "medium"
    if m:
        v = m.group(1).strip().lower()
        if v in ("easy", "medium", "hard"):
            return v
    return "medium"


def _is_pass(review_path: Path) -> bool:
    if not review_path.exists():
        return False
    try:
        m = _REVIEW_VERDICT_RE.search(review_path.read_text())
    except OSError:
        return False
    return bool(m) and m.group(1).upper() in ("PASS", "APPROVE")


@dataclass
class TicketContext:
    workspace: Repo
    roster: Roster
    name: str
    tdir: Path
    tunables: Tunables = field(default_factory=get_tunables)
    telemetry: object = None

    @property
    def ticket_file(self) -> Path: return self.tdir / "ticket.md"
    @property
    def subroot(self) -> Path: return self.tdir / "subtickets"
    @property
    def reviews_dir(self) -> Path: return self.tdir / ".reviews"


def _read_harness_failure(metrics_path: Path) -> dict | None:
    """Return the `harness_failure` block from metrics.json if present.
    capture_run writes this block whenever wait_for_game timed out and the
    dev servers themselves never came up (port leak, foreign holder, etc.).
    A None return means the capture either succeeded or failed for some
    reason other than harness infra — the round loop should proceed normally.
    """
    try:
        return json.loads(metrics_path.read_text()).get("harness_failure")
    except (OSError, json.JSONDecodeError):
        return None


def should_escalate_harness_failure(infra_failure: dict | None) -> bool:
    """True only when capture_run diagnosed a harness infra signature."""
    return infra_failure is not None and bool(infra_failure.get("detected"))


def _carry_harness_failure_into_feedback(ctx: TicketContext, review_fb: Path,
                                           round_n: int,
                                           failure: dict) -> None:
    with put_review_fb(review_fb) as f:
        f.write(f"# Harness infra escalation — round {round_n} ({datetime.now():%F %T})\n\n")
        f.write("`capture_run` could not start the dev servers and bailed out of\n")
        f.write("the round loop. This is a HARNESS bug, NOT a code defect — the\n")
        f.write("ticket implementation is presumed correct. Rescue should fix the\n")
        f.write("infrastructure (edits under `harness/**` are allowed in this mode).\n\n")
        f.write("## harness_failure block from metrics.json\n\n```json\n")
        f.write(json.dumps(failure, indent=2))
        f.write("\n```\n")


def _carry_scope_conflict_into_feedback(ctx: TicketContext, review_fb: Path,
                                          round_n: int) -> None:
    with put_review_fb(review_fb) as f:
        f.write(f"# Round {round_n}: SCOPE-CONFLICT sentinel\n\n")
        f.write("A sub-ticket implementer flagged that an acceptance criterion\n"
                "could not be satisfied within its scope. Re-decompose this\n"
                "ticket with the relevant sub-tickets restructured.\n")


def ticket(ctx: TicketContext) -> int:
    """Ticket loop. Wraps body in tee_pipeline_log → tdir/log.txt (claude
    impl-review blocker fix)."""
    log_path = ctx.tdir / "log.txt"
    ctx.tdir.mkdir(parents=True, exist_ok=True)
    log_path.write_text("")
    with tee_pipeline_log(log_path):
        return _ticket_body(ctx)


def _ticket_body(ctx: TicketContext) -> int:
    base_ref = ctx.workspace.head()
    review_fb = ctx.tdir / "review-feedback.md"
    decomp_role = ctx.roster.role("decomposer")
    log(f"========== {ctx.name} : starting ticket (base {base_ref[:8]}) ==========")

    for round_n in range(1, ctx.tunables.ticket_max_rounds + 1):
        log(f"========== {ctx.name} : round {round_n}/{ctx.tunables.ticket_max_rounds} ==========")
        emit_progress_event("ticket_round_start", {
            "ticket": ctx.name, "round": round_n,
            "maxRounds": ctx.tunables.ticket_max_rounds,
        })

        decomp_chain = decompose(decomp_role, workspace=ctx.workspace,
                                  ticket_name=ctx.name, ticket_file=ctx.ticket_file,
                                  subtickets_dir=ctx.subroot, round_n=round_n,
                                  review_fb=review_fb, artifacts_dir=ctx.tdir,
                                  telemetry=ctx.telemetry)
        verify_reviews(ctx.reviews_dir, ctx.tdir)

        subs = list_subticket_dirs(ctx.subroot)
        if not subs:
            if not decomp_chain.final.ok:
                log(f"[decompose] decomposition call FAILED (rc={decomp_chain.final.rc}) — re-decomposing next round")
                continue
            log("[decompose] no sub-tickets produced — using ticket as a single sub-task")
            atomic_dir = ctx.subroot / "01-main"
            atomic_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ctx.ticket_file, atomic_dir / "ticket.md")
            subs = list_subticket_dirs(ctx.subroot)

        failed_subs: list[str] = []
        rescope_round = False
        for sub in subs:
            if (sub / ".passed").exists():
                continue
            sub_rc = subtask(SubtaskContext(
                workspace=ctx.workspace, roster=ctx.roster, subdir=sub,
                label=f"{ctx.name}/{sub.name}", tunables=ctx.tunables,
                telemetry=ctx.telemetry,
            ))
            if sub_rc == 0:
                continue
            if sub_rc == 1:
                failed_subs.append(sub.name)
                continue
            if sub_rc == 2:
                return 2
            if sub_rc == 3:
                log(f"[scope-conflict] sub {sub.name} flagged — re-decomposing next round")
                rescope_round = True
                break

        if rescope_round:
            _carry_scope_conflict_into_feedback(ctx, review_fb, round_n)
            continue

        if failed_subs:
            log(f"[round {round_n}] {len(failed_subs)} sub-ticket(s) failed: {', '.join(failed_subs)}")
            with put_review_fb(review_fb) as f:
                f.write(f"# Round {round_n}: sub-tickets failed before review ({datetime.now():%F %T})\n\n")
                f.write(f"The following sub-tickets exhausted MAX_ITER without passing QA:\n\n")
                for lbl in failed_subs:
                    f.write(f"- `{lbl}` — see `{ctx.subroot}/{lbl}/log.txt`\n")
                f.write("\nReview was skipped this round — re-decompose to address these.\n")
            continue

        # CAPTURE_RUN + COVERAGE + REVIEW (all subs passed)
        rdir = ctx.tdir / f"round-{round_n}"
        rdir.mkdir(parents=True, exist_ok=True)
        capture_run(rdir, game_url=ctx.tunables.game_url, ports=ctx.workspace.ports)
        # Infra-escalation: capture_run writes a `harness_failure` block in
        # metrics.json when the dev servers themselves could not start (vite
        # EADDRINUSE, port held by foreign proc, etc.). That is a harness
        # bug, not a code defect — running review + more rounds just burns
        # cycles. Bail out of the round loop and jump straight to claude
        # rescue, which is allowed to edit harness/** to fix the infra.
        infra_failure = _read_harness_failure(rdir / "metrics.json")
        if should_escalate_harness_failure(infra_failure):
            log(f"[escalate] harness infra failure ({','.join(infra_failure.get('detected', [])) or 'unknown'}) "
                f"on round {round_n} — skipping review and remaining rounds, jumping to claude rescue")
            emit_progress_event("harness_infra_escalation", {
                "ticket": ctx.name, "round": round_n,
                "detected": infra_failure.get("detected", []),
            })
            _carry_harness_failure_into_feedback(ctx, review_fb, round_n, infra_failure)
            break
        coverage_dir = ctx.tdir / f"coverage-round-{round_n}" if ctx.tunables.pipeline.coverage_enabled else None
        if coverage_dir:
            coverage_run(ctx.workspace, base_ref, coverage_dir,
                          tunables=ctx.tunables.pipeline,
                          ticket_name=ctx.name, round_n=round_n)
            copy_coverage_into_artifacts(coverage_dir, rdir)

        difficulty = _difficulty(ctx.ticket_file)
        review_role = ctx.roster.role("review", difficulty=difficulty)
        emit_progress_event("review_start", {
            "ticket": ctx.name, "round": round_n, "difficulty": difficulty,
            "agent": review_role.primary.name, "review": str(rdir / "review.md"),
        })
        review_chain = review_role.execute(
            workspace=ctx.workspace,
            prompt_vars={
                "TICKET_FILE": str(ctx.ticket_file),
                "ARTIFACTS_DIR": str(rdir),
                "REVIEW_FB": str(review_fb),
                "BASE_REF": base_ref,
                "REVIEW_OUT": str(rdir / "review.md"),
                "GAPS_OUT": str(rdir / "gaps.md"),
                "NITS_OUT": str(rdir / "nits.md"),
            },
            artifacts_dir=rdir,
            telemetry=ctx.telemetry,
        )
        if review_chain.accepted_by is None:
            log("[review] all tiers exhausted without a usable review — escalating")
            return 2
        if not (rdir / "review.md").exists():
            recover_review_files(review_chain.final.stdout, rdir)

        protect_review(label=f"round-{round_n}", working_dir=rdir,
                        archive_dir=ctx.reviews_dir)

        review_out = rdir / "review.md"
        if _is_pass(review_out):
            emit_progress_event("review_verdict", {
                "ticket": ctx.name, "round": round_n, "verdict": "PASS",
                "review": str(review_out), "agent": review_chain.accepted_by.name,
                "difficulty": difficulty,
            })
            finalize_result = finalize(
                workspace=ctx.workspace, ticket_name=ctx.name,
                ticket_file=ctx.ticket_file, artifacts_dir=rdir,
                review_file=review_out, ticket_dir=ctx.tdir,
                game_url=ctx.tunables.game_url, ports=ctx.workspace.ports,
                telemetry=ctx.telemetry,
            )
            if finalize_result == FinalizeResult.SUCCESS:
                emit_progress_event("ticket_complete", {"ticket": ctx.name, "round": round_n})
                return 0
            if finalize_result == FinalizeResult.COMMIT_FAILED:
                return 2
            log("[finalize] review passed but game broken — continuing into next round")

        emit_progress_event("review_verdict", {
            "ticket": ctx.name, "round": round_n, "verdict": "FAIL",
            "review": str(review_out), "agent": review_chain.accepted_by.name,
            "difficulty": difficulty,
        })
        gaps_file = rdir / "gaps.md"
        if gaps_file.exists() and gaps_file.stat().st_size > 0:
            content = gaps_file.read_text()
            with put_review_fb(review_fb) as f:
                f.write(content)
        else:
            with put_review_fb(review_fb) as f:
                f.write(f"# Open gaps — after round {round_n} ({datetime.now():%F %T})\n\n")
                if review_out.exists():
                    tail = [ln for ln in review_out.read_text().splitlines()
                            if not ln.startswith("VERDICT:")][-40:]
                    f.write("\n".join(tail) + "\n")
        append_review_pointer(review_fb, review_out)

    # CLAUDE RESCUE — last resort after rounds exhausted
    log(f"########## {ctx.name} — {ctx.tunables.ticket_max_rounds} rounds exhausted; starting claude rescue ##########")
    rescue_role = ctx.roster.role("rescue")
    rescue_chain = rescue(rescue_role, workspace=ctx.workspace,
                           ticket_name=ctx.name, ticket_file=ctx.ticket_file,
                           review_fb=review_fb, base_ref=base_ref,
                           max_rounds=ctx.tunables.ticket_max_rounds,
                           rescue_dir=ctx.tdir / "rescue", telemetry=ctx.telemetry)
    if rescue_chain.accepted_by is None:
        log("[tool-failure] claude rescue unavailable — escalating")
        return 2
    verify_reviews(ctx.reviews_dir, ctx.tdir)

    # RE-REVIEW after rescue
    rrdir = ctx.tdir / "rescue-review"
    rrdir.mkdir(parents=True, exist_ok=True)
    capture_run(rrdir, game_url=ctx.tunables.game_url, ports=ctx.workspace.ports)
    difficulty = _difficulty(ctx.ticket_file)
    review_role = ctx.roster.role("review", difficulty=difficulty)
    rrchain = review_role.execute(
        workspace=ctx.workspace,
        prompt_vars={
            "TICKET_FILE": str(ctx.ticket_file),
            "ARTIFACTS_DIR": str(rrdir),
            "REVIEW_FB": str(review_fb),
            "BASE_REF": base_ref,
            "REVIEW_OUT": str(rrdir / "review.md"),
            "GAPS_OUT": str(rrdir / "gaps.md"),
            "NITS_OUT": str(rrdir / "nits.md"),
        },
        artifacts_dir=rrdir,
        telemetry=ctx.telemetry,
    )
    if not (rrdir / "review.md").exists():
        recover_review_files(rrchain.final.stdout, rrdir)
    protect_review(label="rescue-review", working_dir=rrdir,
                    archive_dir=ctx.reviews_dir)
    if _is_pass(rrdir / "review.md"):
        finalize_result = finalize(
            workspace=ctx.workspace, ticket_name=ctx.name,
            ticket_file=ctx.ticket_file, artifacts_dir=rrdir,
            review_file=rrdir / "review.md", ticket_dir=ctx.tdir,
            game_url=ctx.tunables.game_url, ports=ctx.workspace.ports,
            telemetry=ctx.telemetry,
        )
        if finalize_result == FinalizeResult.SUCCESS:
            return 0
        if finalize_result == FinalizeResult.COMMIT_FAILED:
            return 2
        # GAME_BROKEN: bash falls through to split here; we do the same.

    # SPLIT
    log(f"[split] {ctx.name} unsolved after {ctx.tunables.ticket_max_rounds} rounds + claude rescue — restructuring")
    split_role = ctx.roster.role("split")
    if split(split_role, workspace=ctx.workspace, ticket_name=ctx.name,
              ticket_file=ctx.ticket_file, base_ref=base_ref,
              ticket_dir=ctx.tdir, split_dir=ctx.tdir / "split",
              telemetry=ctx.telemetry):
        log(f"########## {ctx.name} SPLIT — smaller tickets queued; backlog will pick them up ##########")
        return 3
    log(f"########## {ctx.name} could not be split — left open for a fresh attempt ##########")
    return 1


__all__ = ["TicketContext", "ticket"]
