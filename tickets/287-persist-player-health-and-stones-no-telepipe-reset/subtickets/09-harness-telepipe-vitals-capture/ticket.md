# 09 — Harness capture asserts vitals persist through telepipe redeploy

Round-1 runtime proof failed because the fallback screenshot capture still runs the old suspend→resume flow with `assertRunPreserved` (enemy ID / checkpoint objective checks). Update harness capture and hub telepipe validation to assert **player HP and magic stones persist** through telepipe-up → hub → fresh redeploy, while accepting a **new** `runId` and **no** checkpoint restore.

## Acceptance Criteria

- Ticket 287 (and round folders for this ticket) no longer route to the `isTelepipeTicket` suspend→resume branch that ends in `assertRunPreserved`.
- Fallback capture for this ticket: solo telepipe-up → hub lobby → redeploy → probe compares pre-telepipe vs post-redeploy **HP and magic stones** (MS within passive-regen tolerance); asserts **different** `runId`; does **not** require matching enemy IDs, layout seed, or suspended objective.
- New or updated capture step (e.g. `assertVitalsPreserved`) records a `vitalsPreservation` block in metrics/probes and fails only on HP/MS mismatch (not enemy preservation).
- `metrics.json` from a clean capture run reports `"ok": true` for this ticket's acceptance path.
- Hub playthrough telepipe step (`runTelepipeResetStep` or successor) asserts vitals **preserved** (`telepipeVitalsPreserved === true`) instead of the ticket-281 MS-reset semantics (`telepipeUpReset` expecting MS return to `STARTING_MAGIC_STONES`).
- No forbidden `[run] checkpoint restored` in server log slice during the telepipe step.

## Technical Specs

- No `game/` source changes required — this sub-ticket is harness-only.
- **`harness/screenshot.mjs`** — Add detection for ticket 287 / persist-vitals telepipe tickets (e.g. match `287-persist`, `persist-player-health`, or explicit ticket prose) so `fallbackRecipe()` uses a vitals-preservation step list instead of `assertRunPreserved`. Implement `assertVitalsPreserved` (or equivalent) comparing stashed pre-telepipe probe HP/MS to post-redeploy probe; stash HP in baseline probe alongside MS.
- **`harness/validate/lib/telepipe.mjs`** — Add `probesMatchVitalsPreserved(pre, post)` (HP exact match; MS within regen tolerance). Update or fork `runTelepipeResetStep` so ticket-287 hub validation expects preserved vitals + fresh `runId`, not `probesMatchFreshDeploy` MS reset.
- **`harness/validate/playthrough.mjs`** — Wire new assertion key (e.g. `telepipeVitalsPreserved`) for this ticket's hub preset; stop requiring `telepipeUpReset === true` when validating 287.
- **`harness/validate/verify-hub-artifacts.mjs`** — Accept the new probes/assertion shape for 287 round artifacts.

## Verification: code
