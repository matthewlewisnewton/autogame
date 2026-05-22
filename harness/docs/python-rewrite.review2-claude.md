# Claude review of python-rewrite.md v2 — round 2

## ROUND 1 CONCERNS — STATUS

- [FIXED] Three retry layers must be called out as distinct. §3.1 has the table.
- [FIXED] Capability Flag and cost_tier dropped from §5.
- [FIXED] FailureReason Enum, full bash vocabulary ported. Shared between spawn.classify, Role fallback, telemetry.
- [FIXED] HARNESS_USAGE_KIND wiring — UsageKind enum + AgentInvocation.usage_kind, no env-var indirection.
- [FIXED] AgentResult.diff cost. Dropped; ScopeAudit owns the snapshot.
- [FIXED] Verdict-vs-files-written acceptance — AcceptanceCriterion ABC with three kinds in §6.1.
- [FIXED] extra: Mapping[str,str] escape hatch — replaced by per-Agent typed config dataclasses, discriminated by backend:.
- [FIXED] Workspace ABC overbuilt on day 1. §7.1 commits to one concrete Repo; ABC deferred to phase 6. PathScope removed from workspace API.
- [FIXED] YAML anchors — §6.3 named agents: mapping. Kept anchors only for _role_defaults (local-only, legitimate use).
- [FIXED] roles.local.yaml field-level merge — §6.6 Pydantic model_copy(update=…).
- [FIXED] Three review roles parameterized — review: with primary_by_difficulty: map.
- [FIXED] Combinator workflow engine — §3.3 and §8 throw out combinators; pipelines are plain functions.
- [FIXED] Missing rescue, split, finalize, protect_review, verify_reviews, capture_run, coverage, ingest_nits, confirm_game_broken, revert_game_changes, filter_agent_feedback_noise — all in §4, §8, §10.
- [FIXED] rc=3 (ticket split) — §8.3 backlog() has 4-way switch verbatim.
- [FIXED] Non-role tunables — §6.3 tunables: top-level section.
- [FIXED] Hot-reload boundary — §6.5 commits to top-level-supervisor-only.
- [FIXED] log.txt captures all pipeline output — §9.4 tee_pipeline_log context manager.
- [FIXED] agent_bucket_for_label — §5.1 bucket field on Agent.
- [FIXED] progress/server.mjs lifecycle — §9.3 supervisor-managed.
- [FIXED] Cutover plan / equivalence test — §11.3 recorded-trace replay + §12 phased PRs.
- [FIXED] lint.sh dead-on-arrival — §10 deleted at cutover.
- [FIXED] Gemini quota fast-fail — §10 retired.
- [FIXED] ensure_handoff mtime → content hash — §8.1.
- [FIXED] Subprocess isolation per sub-ticket — Q3 hard requirement.
- [FIXED] Async dropped for day 1 — §2 non-goals + §5.3.
- [FIXED] commit_verified HEAD-advancement test, ingest_nits TASKS.md test, split parser test, smoke tests assert contract — all in §11.

## NEW PROBLEMS IN v2

1. **SIGHUP handler in §8.4 is buggy.** `signal.signal(signal.SIGHUP, lambda *_: (roster := Roster.reload()))` — walrus in lambda binds a local, never updates outer `roster`. Need `self.roster = Roster.reload()` or a mutable container.

2. **§8.2's ticket() has a control-flow bug on SCOPE-CONFLICT.** `break_into_next_round(); break` only escapes the inner sub-ticket loop; the round loop then falls into capture/coverage/review on an incomplete sub-ticket set. Needs `continue` on the outer loop.

3. **§8.2 omits FAILED_SUBS branch.** The bash (run_ticket.sh:399-436) collects failed sub-tickets into FAILED_SUBS, writes a put_review_fb summary, and continues to next round WITHOUT running review/coverage/capture_run. v2 falls through to capture+coverage+review even when some sub-tickets failed (sub_rc==1 case silently falls through). Meaningful behavioral divergence.

4. **finalize() return semantics in §8.2.** Bash returns 0 on success and 1 on "review passed but game broken." Python skeleton handles success but doesn't show what happens when finalize succeeds AND commit_verified fails inside it (bash does exit 2). Implementer will guess.

5. **§8.2 rescue path doesn't comment the post-rescue review failure path.** Bash falls through to split; design should add a one-line comment.

6. **scope_audit() in Q5 promises "reverts out-of-scope edits" but doesn't define the algorithm.** What does revert mean — git checkout HEAD -- <paths>? What if the role created the file? What if scope is game/** and the file is game/foo.js but the allowlist is narrower? Needs a §7.4 or §6.7 spelling it out.

7. **TICKET_ALLOWS_HARNESS semantics moved to ticket_allows_harness flag on Context but detection rule isn't specified.** Bash run_subtask.sh:35-38 greps ticket file for harness/. v2 references the flag without specifying how it's set.

8. **Equivalence-replay fixture matching key is fragile.** §11.3 step 2 says match by template+role+iteration. Sub-ticket retry of same template+role maps to same key but different call. Need (sub_label, iteration, call_order_within_iteration) or stream-match in order.

9. **§11.3 step 1's --record patch on the rollback tag is chicken-and-egg.** Patched bash recordings on the rollback tag risk timing/output drift from the production bash. Better: record on recent main, freeze that as the equivalence baseline.

10. **primary_by_difficulty: review role has no per-difficulty fallback override.** One shared fallbacks: list for all difficulties; bash today picks different primaries per difficulty and the hard tier may want different fallbacks (e.g. you wouldn't want composer_write as fallback for an extra-high primary). Should support fallbacks_by_difficulty optionally.

11. **Phase 2 ships before Phase 3.** Agents exist before roles can use them. Integration tests against the full stack only possible from phase 3+; doc should say so.

12. **§9.3 progress server lifecycle ambiguous for non-supervisor subcommands.** `python -m harness ticket <name>` doesn't start the server but the ticket pipeline calls emit_progress_event. Either ticket subcommand also calls start_if_needed, or events fall back to file-only without server.

## READY TO IMPLEMENT?

Yes, with three small edits. The substantive blockers are minor and a careful implementer would catch them, but worth a 10-minute pass:

- Fix the SIGHUP closure bug in §8.4 (use self.roster = Roster.reload() or a mutable container, not broken walrus-in-lambda).
- Specify what happens to the round loop when sub-tickets fail (sub_rc == 1) — show FAILED_SUBS accumulation + put_review_fb + continue to next round, mirroring run_ticket.sh:399-436.
- Specify scope_audit()'s "revert out-of-scope edits" algorithm in one paragraph.

Everything else either has a workable answer in the doc, or is a problem the implementer will hit and fix in the normal course of writing code. The architecture is sound, the migration plan is realistic, the test plan is meaningful, and the parity contract in §10 is comprehensive.

## NITS

- §8.4 Supervisor.run() uses signal.signal(signal.SIGHUP, …) — Linux-only, worth a one-line comment.
- §6.3 mixes timeout_s and timeout (vision) — pick one convention.
- §10 "Gemini quota fast-fail — retired" reads better as a footnote.
- §11.3 step 3 "identical git commit SHAs" — SHAs depend on timestamps; mean "identical staged diffs."
- §15 "tests, finally" bullet reads as marketing — tighten.
- §6.3 timeout_s: 7200 for implementer — confirm intentional vs typo.
