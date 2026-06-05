# Make the drift guard inspect dynamic emit expressions instead of ignoring them

The drift-guard test classifies any non-trivial `.emit/.on/.once/.off` first
argument (and any non-literal `event:`/`event =` source) as `dynamic` and drops
it on the floor. That means the ticket's flagged risk class — the dynamic
`io.emit(status === 'victory' ? EVENTS.runComplete : EVENTS.runFailed, summary)`
emit and `phaseMismatch: { event: EVENTS.<name> }` paths — is never validated, so
a typo like `EVENTS.runComplet` or `EVENTS.medicErrr` in those expressions would
pass the guard. Extend the scanner to look *inside* dynamic expressions for both
`EVENTS.<name>` references and raw string literals so every server-emit name
actually resolves through the shared registry.

## Acceptance Criteria

- In `game/server/test/event_name_drift.test.js`, when a `.emit/.on/.once/.off`
  first argument is a dynamic expression (not a bare string literal and not a
  single `EVENTS.<name>` token), the scanner extracts **every** embedded
  `EVENTS.<name>` reference from that expression and feeds them into the
  invariant-2/invariant-3 reference set (so each must resolve to a real
  registry key and counts toward registry coverage).
- The scanner also extracts **every** raw string literal embedded in a dynamic
  first-argument expression and feeds non-allowlisted ones into the invariant-1
  offender set (a raw literal hidden inside a ternary still trips invariant 1).
- The `event:`/`event =` dynamic-source scan likewise collects embedded
  `EVENTS.<name>` references (e.g. `phaseMismatch: { event: EVENTS.keyItemError }`)
  into the invariant-2/invariant-3 reference set, in addition to the raw-literal
  capture it already performs.
- The real `io.emit(status === 'victory' ? EVENTS.runComplete : EVENTS.runFailed, summary)`
  site in `game/server/progression.js` is now exercised by the guard: both
  `runComplete` and `runFailed` appear in the collected reference set when the
  production files are scanned (no longer silently classified as `dynamic`).
- The `demonstrates the failure modes` test is extended to prove the new
  coverage trips on synthetic snippets:
  - a ternary emit with a bogus member,
    `io.emit(cond ? EVENTS.runComplete : EVENTS.runFaild, x)`, surfaces
    `runFaild` as a dangling (invariant-2) reference;
  - a ternary/dynamic emit hiding a raw literal,
    `io.emit(cond ? 'typoEvent' : EVENTS.runFailed, x)`, surfaces `typoEvent`
    as an invariant-1 offender;
  - a `phaseMismatch: { event: EVENTS.medicErrr }` snippet surfaces `medicErrr`
    as a dangling (invariant-2) reference.
- All three existing invariants still pass against the production files
  (`cd game && pnpm test:quick`, or the vitest run covering
  `server/test/event_name_drift.test.js`), with no new offenders and no dangling
  or dead registry keys reported. Genuine lifecycle names on
  `LIFECYCLE_ALLOWLIST` still do not trip invariant 1.

## Technical Specs

- `game/server/test/event_name_drift.test.js` only — do NOT change any
  `game/` source files (the production call sites already route through
  `EVENTS.*`; this sub-ticket only closes the test's blind spot).
- Keep the pure-text approach (`fs.readFileSync` + regex); do not import the
  scanned modules.
- In `classifyCallSites`, replace the "push the whole arg into `dynamic` and
  ignore it" branch: when `arg` is neither a bare string literal nor a single
  `EVENTS.<name>` token, run a global `EVENTS\.([A-Za-z_$][\w$]*)` regex over
  `arg` and push each captured member into `refs`, and run the existing
  `STRING_LITERAL_RE`-equivalent global string-literal regex
  (`(['"`+'`'+`])(?:[^'"`+'`'+`])*\1`) over `arg` and push each inner value into
  `literals`. (Keep returning a `dynamic` array if useful for diagnostics, but it
  must no longer swallow embedded refs/literals.)
- Add an embedded-reference pass to the `event:`/`event =` handling: alongside
  `EVENT_ASSIGN_RE` (raw literals), add a regex such as
  `/\bevent\s*[:=]\s*EVENTS\.([A-Za-z_$][\w$]*)/g` and feed captured members
  into the reference set so dynamic `event: EVENTS.<name>` slots are validated by
  invariants 2 and 3.
- Update `scanAll` (or the helpers it calls) so the newly extracted dynamic refs
  flow into `refNames` and the newly extracted dynamic literals flow into
  `rawLiterals`, exactly like the existing call-site refs/literals.
- Extend the `demonstrates the failure modes` test with the three synthetic
  assertions listed in the acceptance criteria.

## Verification: code
