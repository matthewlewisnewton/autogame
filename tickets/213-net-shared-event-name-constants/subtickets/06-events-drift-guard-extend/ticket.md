# Extend the drift-guard test to cover `.once`/`.off` and dynamic-emit names

The drift-guard test only scans the first argument of `.emit(...)`/`.on(...)`
call sites, so it cannot catch raw event names used by `.once`/`.off` listener
helpers, nor raw literals that feed dynamic emits (e.g. an
`event = 'questUpdate'` default or a `phaseMismatch: { event: 'keyItemError' }`
object). Extend the guard so those paths are covered and the "every server-emit
and client-on name resolves to a shared constant" invariant actually holds.
This sub-ticket depends on 04 and 05 having removed those raw literals first.

## Acceptance Criteria

- The call-site scanner in `game/server/test/event_name_drift.test.js` matches
  `.once(` and `.off(` first arguments in addition to `.emit(` and `.on(`, and
  applies invariant 1 (no raw gameplay literals) to them.
- The test catches raw gameplay event-name literals that are assigned to a
  `phaseMismatch`-style `event:` property or used as an `event = '...'` default
  parameter in the scanned server files (i.e. the cases gap 1 described are
  detectable — a reintroduced `event: 'keyItemError'` would fail the test).
- The `demonstrates the failure modes` test is updated to prove the new
  coverage trips: a synthetic `socket.once('typoEvent', cb)` and a synthetic
  `{ event: 'typoEvent' }` (or `event = 'typoEvent'`) raw literal are each
  detected as offenders.
- With sub-tickets 04 and 05 applied, the full extended test passes
  (`cd game && pnpm test:quick` or the vitest run covering
  `server/test/event_name_drift.test.js`) with no offenders reported.
- Genuine lifecycle names already on `LIFECYCLE_ALLOWLIST` (e.g. `disconnect`,
  `connect`) still do not trip invariant 1.

## Technical Specs

- `game/server/test/event_name_drift.test.js`:
  - Broaden `CALL_SITE_RE` from `/\.(emit|on)\s*\(.../` to also include `once`
    and `off`: `/\.(emit|on|once|off)\s*\(\s*([^,)\s][^,)]*)/g`.
  - Add a second scan pass (a new regex over the same scanned source) that
    captures raw string literals assigned to an `event` field/parameter —
    e.g. match `event\s*[:=]\s*(['"`][^'"`]+['"`])` — and feed any non-allowlisted
    literal into the invariant-1 offender list alongside the call-site literals.
  - Keep the existing pure-text approach (`fs.readFileSync` + regex); do not
    import the client/server modules.
  - Extend the `demonstrates the failure modes` test with assertions covering a
    raw `.once`/`.off` literal and a raw `event:`/`event =` literal.
- Do not change game source files in this sub-ticket (those are 04/05); only the
  test changes here. The `SCANNED_FILES` list already includes the relevant
  server and client files.

## Verification: code
