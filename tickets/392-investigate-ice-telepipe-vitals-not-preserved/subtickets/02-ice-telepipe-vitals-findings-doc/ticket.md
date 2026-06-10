# Document the ice telepipe vitals investigation conclusion

Capture the outcome of the investigation in a findings document so the result of
ticket 372's `telepipeVitalsPreserved` FAIL on the ice level is recorded:
whether vitals truly fail to persist on ice (a **real bug**, now fixed) or the
FAIL was a **validation artifact** (e.g. missing ice telepipe harness/scenario,
not a game defect). The conclusion must be grounded in the regression test added
in sub-ticket 01.

## Acceptance Criteria

- `game/validation/ice/findings.md` exists and follows the same structure as
  `game/validation/fire/findings.md` (Outcome, Preset, an Assertions list that
  includes a `telepipeVitalsPreserved` line, and a Telepipe section recording
  pre-suspend vs post-redeploy HP and MS).
- The doc states a clear, evidence-backed conclusion: **real bug** (with the root
  cause and the `game/server` fix location/summary) OR **validation artifact**
  (with what was actually missing/misconfigured), consistent with what sub-ticket
  01's regression test demonstrates.
- The doc references the new regression test by name/file as the reproduction and
  pins the result to the `frost_crossing` / ice-cavern level.
- Any genuinely incomplete follow-up (e.g. building a Playwright `ice` validation
  preset to mirror `fire`, if not done here) is listed under a Follow-ups section.

## Technical Specs

- **`game/validation/ice/findings.md`** — new file (create the `game/validation/ice/`
  directory). Mirror the headings used in `game/validation/fire/findings.md`
  (Outcome / Preset / Assertions / Telepipe / Console errors / Follow-ups). No
  screenshots are required since this conclusion is established by the server-side
  regression test, not a Playwright run — note that explicitly.
- Do NOT change game code or tests here; this sub-ticket is documentation only and
  records the conclusion produced by sub-ticket 01.

## Verification: code
