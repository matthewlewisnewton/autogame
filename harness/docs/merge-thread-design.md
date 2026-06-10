# Off-thread merge queue + failure containment — combined design

Two parallel investigations (2026-06-10) into moving the merge queue off the
dispatcher tick thread, with backpressure and failure recovery. Full designs
live in the session transcript; this captures the agreed architecture and the
phased rollout. Empirical inputs: ~2 merges/hr service rate, resolver fires on
~80% of merges, tick freezes up to ~30 min per transaction, 26 merges with 0
losses on the night of 2026-06-09→10.

## Architecture (threading)

- Dedicated merge worker thread owned by MergeQueue: inbox `queue.Queue` of
  WorkerHandles, outbox `queue.Queue` of `MergeOutcome(kind, handle, reason)`.
- The merge thread runs ONLY git/verify/agent work. Everything that writes
  shared state marshals back as an outcome applied by the tick thread in
  `apply_outcomes()` (replacing the `merge_drain` callsite): all `bd` calls
  (close/requeue/set_difficulty via note_merge_reject), PENDING_MERGE rewrite,
  MERGED_UNCLOSED append, breaker dict mutations + _save_state, and worktree
  teardown (keeps ALL `git worktree`/`branch -D` ops on one thread — no
  prune/add races).
- Single-writer enforcement: `BeadsQueue` records its owner thread and raises
  on use from any other thread (a wedged `bd` on the merge thread would
  recreate the Dolt-lock dispatcher freeze; `requeue` is check=True and would
  lose tickets on contention failures).
- `drain_one()` survives as a synchronous shim (transaction inline + outcome
  inline) so the existing test suite passes; `merge_thread: false` factory.yaml
  flag is the rollout escape hatch.
- `pending()` = inbox + in-flight, so drain-exit and backpressure see the
  in-flight transaction.
- Agent spawns on the merge thread are safe (audited: no signal handlers, no
  shared mutable Role state, flock-guarded telemetry). Caveat: qwen agents
  mutate os.environ — merge role chains must stay qwen-free (startup warning).

## Bounding (both designs converged)

- `Repo.run_git` gains optional `timeout_s`; merge-path git calls bounded
  (600s heavy / 60s light).
- Transaction deadline `merge_max_s` (default 3600s) checked before each phase
  (rebase/resolve/verify/fix/each ff attempt) AND clamped into the agent
  tiers (`role.timeout_s = min(spec, remaining)`) — otherwise a resolve chain
  can legally run 90+ min (3 tiers × 1800s).
- Abort procedure provably main-safe: only `merge --ff-only` ever writes main
  (atomic ref move); abort = merge/rebase --abort + reset to recorded branch
  sha → normal reject path. Sanitize-at-transaction-start (abort leftover
  rebase/merge state) fixes a latent recovery bug too.
- Watchdog past deadline+grace is alert-only (threads can't be killed; every
  blocking call is individually bounded, so a permanent hang is
  impossible-by-construction).

## Backpressure (with numbers)

- λ (pass arrivals) ≈ 2–3/hr vs μ (merge service) ≈ 2/hr → ρ ≥ 1: unbounded
  growth without a cap, and depth is self-amplifying (queued branches go
  staler → more resolver time → lower μ).
- Cap = `max(2, workers // 2)` = 3 at 6 workers, counting in-flight. Deepest
  wait ≈ 1h, worst outstanding worktrees 3+6=9. Strictly better than today
  (today every merge freezes ALL claims).
- Do NOT periodically re-rebase waiting branches: the staleness event is the
  previous merge landing immediately before your turn; the transaction's own
  first-step rebase happens at exactly the right moment. The lever is depth,
  not freshness.

## Failure containment (defense in depth)

1. **Resolver/fixer commit gates** (closes the add -A class that poisoned
   main): resolve stages ONLY the conflict set (`git add -- <C>`), reject
   tracked modifications/deletions outside C, untracked never staged;
   post-commit parent-subset check catches invented paths. Fixer: paths
   under game/** only, ≤30 files / ≤2000 lines / ≤2 deletions, stage by
   validated pathspec. Prompt line: "writes outside scope auto-reject".
2. **mk6a**: quarantine (move-aside, never clean) untracked paths colliding
   with main before the resolve merge; _abort_merge tolerates MERGE_HEAD
   missing.
3. **Cross-ticket consecutive-reject breaker** (the 4-ticket-massacre
   instrument): MergeQueue counts consecutive rejects across beads (persisted);
   at 3, set `harness/tmp/merge_halt.flag` (survives restart), STOP POPPING —
   preserving PENDING_MERGE entries and worktrees — and alert. Stage-tagged
   `merge_stage_failed` events (rebase|resolve_merge|resolve_agent|
   invariant_gate|verify|fix|ff) make systemic patterns one query.
4. **Post-merge main smoke** (catches vitest-green breakage — "merge agent
   broke the game"): merge journal (`harness/tmp/merge_journal.ndjson`:
   bead, ticket, pre_sha, post_sha, resolved/fixed) written after each ff;
   then boot main + screenshot.mjs probe on a RESERVED port pair (~1-2 min,
   one flake retry). Serialized merges ⇒ blame is always the last journal
   row. On red: halt flag + alert (ship first); auto-revert
   (`git revert pre..post`, `-m 1` for merge commits, then vitest+smoke the
   revert; bead routed through note_merge_reject → escalate/abandon) ships
   after the revert path has tests.
5. **bd close correctness**: `BeadsQueue.close(force=True)` for merged work
   (code is on main regardless of bead deps — the 1t90 stranding); reconcile
   keeps MERGED_UNCLOSED records whose close FAILED instead of unlinking the
   whole file.

## Phased rollout

- **Phase A (no restart needed, behavior-safe, ~1 day):** containment items
  1, 2, 3, 5 + threading Step 1 (pure refactor: `_merge_one` returns
  MergeOutcome; `apply_outcome`; sync shim). These would have prevented or
  contained every incident to date.
- **Phase B (lands dark):** thread + mailboxes behind `merge_thread: false`;
  beads thread-owner assertion; git timeouts; deadline; heartbeat/status merge
  section; smoke + journal + halt (smoke works inline too — ~2 min/merge).
- **Phase C (restart window):** drain (guarantees empty merge queue), flip
  `merge_thread: true`, observe one night (heartbeat ticking through merges,
  claims continuing, backpressure toggling), then enable auto-revert and make
  threaded the default.
- Rollback at any point: `merge_thread: false` + drain-restart (lossless).

## Top risks

1. Concurrent git on the shared .git (merge thread ff vs tick thread worktree
   add/prune) → all worktree lifecycle stays tick-thread; ff already retries
   transient locks; add one retry to WorktreeWorkspace.create.
2. Deadline rejecting healthy-slow merges inflating the merge breaker →
   3600s ≥ 2× empirical mean; distinct reason string; tune via config.
3. Crash windows around outcome application → verified self-healing (ff→close
   re-merge is trivial "already up to date"; close→teardown cleaned by
   clean_orphan_worktrees); PENDING_MERGE writes stay tick-thread-exclusive.
