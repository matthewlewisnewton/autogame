"""subtask() — port of run_subtask.sh per design doc §8.1.

Returns:
   0 = passed (committed)
   1 = failed after MAX_ITER
   2 = tool failure (escalate)
   3 = SCOPE-CONFLICT sentinel
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from harness.agents.base import FailureReason
from harness.config.tunables import Tunables, get_tunables
from harness.roles import Roster
from harness.steps.commit import commit_with_role
from harness.steps.feedback import accumulate_feedback
from harness.steps.game import start_game, stop_game, wait_for_game
from harness.steps.handoff import ensure_handoff, scope_conflict_sentinel_in, sha256_of
from harness.steps.implement import implement
from harness.steps.pipeline_checks import background_vitest, finish_background_vitest
from harness.steps.qa import parse_verdict, qa
from harness.steps.revert_game import revert_game_changes
from harness.steps.screenshot import capture
from harness.steps.vision_feedback import optional_vision_feedback
from harness.telemetry.logging import log, tee_pipeline_log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.repo import Repo


_QA_MODE_RE = re.compile(r"^\s*##?\s*Verification\s*:\s*(\w+)\s*$", re.MULTILINE | re.IGNORECASE)
_HARNESS_REF_RE = re.compile(r"(^|[^A-Za-z0-9_./-])harness/")


def _detect_qa_mode(ticket_file: Path) -> str:
    try:
        text = ticket_file.read_text()
    except OSError:
        return "visual"
    m = _QA_MODE_RE.search(text)
    if m:
        v = m.group(1).strip().lower()
        if v in ("visual", "code"):
            return v
    return "visual"


def _detect_ticket_allows_harness(ticket_file: Path) -> bool:
    try:
        return bool(_HARNESS_REF_RE.search(ticket_file.read_text()))
    except OSError:
        return False


@dataclass
class SubtaskContext:
    workspace: Repo
    roster: Roster
    subdir: Path
    label: str
    tunables: Tunables = field(default_factory=get_tunables)
    telemetry: object = None

    @property
    def ticket_file(self) -> Path: return self.subdir / "ticket.md"
    @property
    def feedback(self) -> Path: return self.subdir / "feedback.md"
    @property
    def handoff(self) -> Path: return self.subdir / "handoff.md"


def subtask(ctx: SubtaskContext) -> int:
    """Inner loop. Wraps the body in tee_pipeline_log so all stdout/stderr
    AND log() lines land in ctx.subdir/log.txt — the same shape as
    bash's `exec > >(tee -a "$SUBDIR/log.txt") 2>&1` (claude impl-review
    blocker; was silently unwired in Phase 4)."""
    log_path = ctx.subdir / "log.txt"
    # Truncate at start of sub-ticket — bash's `: > "$SUBDIR/log.txt"`.
    ctx.subdir.mkdir(parents=True, exist_ok=True)
    log_path.write_text("")
    with tee_pipeline_log(log_path):
        return _subtask_body(ctx)


def _subtask_body(ctx: SubtaskContext) -> int:
    qa_mode = _detect_qa_mode(ctx.ticket_file)
    ticket_allows_harness = _detect_ticket_allows_harness(ctx.ticket_file)
    log(f"=== sub-ticket: {ctx.label} — QA mode: {qa_mode} ===")
    emit_progress_event("subtask_start", {
        "label": ctx.label, "ticketFile": str(ctx.ticket_file), "qaMode": qa_mode,
    })

    coder_toolfail = 0
    impl_role = ctx.roster.role("implementer")

    for iteration in range(1, ctx.tunables.max_iter + 1):
        arti = ctx.subdir / "artifacts" / f"iter-{iteration}"
        arti.mkdir(parents=True, exist_ok=True)
        emit_progress_event("iteration_start", {
            "label": ctx.label, "iteration": iteration,
            "maxIterations": ctx.tunables.max_iter, "artifacts": str(arti),
        })

        # 1. IMPLEMENT
        handoff_hash_before = sha256_of(ctx.handoff)
        # Capture/rerun sub-tickets legitimately produce deliverables in the
        # parent ticket's round-* artifact dir; allow the implementer to write
        # there so scope_audit doesn't revert them (review.md/gaps.md/nits.md
        # stay protected via protect_review's chmod + verify_reviews restore).
        round_glob = f"tickets/{ctx.label.split('/')[0]}/round-*"
        chain = implement(impl_role, workspace=ctx.workspace,
                          ticket_file=ctx.ticket_file, feedback=ctx.feedback,
                          handoff=ctx.handoff, artifacts_dir=arti,
                          allow_harness=ticket_allows_harness,
                          extra_safe_paths=[round_glob], telemetry=ctx.telemetry)
        coder_result = chain.final
        coder_out = arti / impl_role.out_file
        ensure_handoff(ctx.handoff, before_hash=handoff_hash_before,
                       attempt=iteration, coder_result=coder_result, coder_out=coder_out)

        if scope_conflict_sentinel_in(ctx.handoff):
            log("[scope-conflict] implementer flagged unfixable-in-scope ACs — exiting 3")
            return 3

        if not coder_result.ok:
            # A SCOPE_VIOLATION means the agent ran fine but wrote files outside
            # its allowed scope (scope_audit already reverted them). That is NOT a
            # tool outage — counting it toward coder_toolfail wrongly aborts the
            # whole backlog with rc=2, and a structurally-impossible sub-ticket can
            # then kill the supervisor via repeated escalation. Treat it as a
            # recoverable per-iteration failure: feed the reverted paths back and
            # retry; max_iter exhaustion returns rc=1 (re-decompose) not rc=2.
            if getattr(coder_result, "reason", None) == FailureReason.SCOPE_VIOLATION:
                log(f"[scope-violation] {ctx.label}: out-of-scope writes reverted — "
                    f"not a tool failure; accumulating feedback and retrying")
                accumulate_feedback(
                    ctx.feedback, iteration=iteration,
                    qa_text="Your out-of-scope file writes were reverted by scope_audit. "
                            "Only modify files within your allowed scope.")
                continue
            coder_toolfail += 1
            log(f"[tool-failure] implementer call failed ({coder_toolfail} consecutive)")
            if coder_toolfail >= 2:
                log(f"=== ABORT {ctx.label}: coder tool repeatedly unavailable — escalating ===")
                return 2
            continue
        coder_toolfail = 0

        # 2. PIPELINE CHECKS (background) + GAME (foreground)
        pipeline_handle = background_vitest(arti, ctx.tunables.pipeline, label=ctx.label)
        ports = ctx.workspace.ports
        log("[game] starting servers...")
        start_game(arti, ports)
        game_live = wait_for_game(ports, timeout_s=45)
        if game_live:
            log("[playwright] capturing screenshots...")
            capture(ctx.tunables.game_url, arti)
            emit_progress_event("capture_complete", {
                "label": ctx.label, "iteration": iteration,
                "artifacts": str(arti), "status": "captured",
            })
        else:
            log("[game] SERVERS FAILED TO START")
            (arti / "metrics.json").write_text(
                json.dumps({"ok": False, "error": "servers did not start"}) + "\n"
            )
            for f in ("console.log", "server.log", "client.log"):
                (arti / f).touch()
            emit_progress_event("capture_complete", {
                "label": ctx.label, "iteration": iteration,
                "artifacts": str(arti), "status": "servers_failed",
            })

        keep_game_running = (game_live and qa_mode == "visual"
                             and ctx.tunables.vision.feedback_on_fail)
        if not keep_game_running:
            stop_game()

        try:
            if ticket_allows_harness:
                diff_text = ctx.workspace.run_git("diff", "HEAD", "--", ".", ":!tickets")
            else:
                diff_text = ctx.workspace.run_git("diff", "HEAD", "--", "game/")
        except Exception:
            diff_text = ""
        (arti / "changes.diff").write_text(diff_text + "\n" if diff_text else "")
        finish_background_vitest(pipeline_handle, label=ctx.label)

        # 3. QA
        qa_role = ctx.roster.role(f"qa:{qa_mode}")
        qa_chain = qa(qa_role, workspace=ctx.workspace,
                       ticket_file=ctx.ticket_file, artifacts_dir=arti,
                       telemetry=ctx.telemetry)
        if qa_chain.accepted_by is None:
            log("[tool-failure] all QA tiers exhausted with no verdict — escalating")
            return 2
        emit_progress_event("qa_verified", {
            "label": ctx.label, "iteration": iteration,
            "agent": qa_chain.accepted_by.name, "mode": qa_mode,
        })

        # 4. VERDICT
        qa_text = (arti / qa_role.out_file).read_text() if (arti / qa_role.out_file).exists() else qa_chain.final.stdout
        verdict = parse_verdict(qa_text)
        emit_progress_event("qa_verdict", {
            "label": ctx.label, "iteration": iteration,
            "verdict": verdict or "UNKNOWN", "qaFile": str(arti / qa_role.out_file),
        })
        if verdict == "PASS":
            if keep_game_running:
                stop_game()
            committer = ctx.roster.role("committer")
            if not commit_with_role(committer, workspace=ctx.workspace,
                                     ticket_file=ctx.ticket_file, label=ctx.label,
                                     fallback_message=f"{ctx.label}: sub-ticket verified (iter {iteration})",
                                     artifacts_dir=arti,
                                     include_harness=ticket_allows_harness,
                                     telemetry=ctx.telemetry):
                return 2
            (ctx.subdir / ".passed").write_text("")
            log(f"=== sub-ticket PASSED: {ctx.label} ===")
            emit_progress_event("subtask_passed", {"label": ctx.label, "iteration": iteration})
            return 0

        log("[qa] FAIL — accumulating feedback")
        if qa_mode == "visual" and ctx.tunables.vision.feedback_on_fail:
            optional_vision_feedback(ctx.roster.role("vision_feedback"),
                                      workspace=ctx.workspace,
                                      ticket_file=ctx.ticket_file,
                                      qa_file=arti / qa_role.out_file,
                                      artifacts_dir=arti, game_url=ctx.tunables.game_url,
                                      label=ctx.label, iteration=iteration,
                                      telemetry=ctx.telemetry)
        if keep_game_running:
            stop_game()
        accumulate_feedback(ctx.feedback, iteration=iteration, qa_text=qa_text)

    log(f"=== sub-ticket FAILED after {ctx.tunables.max_iter} iterations: {ctx.label} ===")
    revert_game_changes(ctx.workspace)
    return 1


__all__ = ["SubtaskContext", "subtask"]
