# Senior review: Client registration success message

**Ticket:** `client-registration-success-message-rendered-into-hidden-err-4dy2`  
**Baseline:** `dafa0c7f2fd722aa4ffc520ccf1d7e9d35bb3696`  
**Implementation commit:** `d88d6808` — `01-show-success-on-login-form`

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | Absent |
| `console.log` pageerror / `[fatal]` from game code | None |

The captured run started client and server cleanly, connected two players, entered gameplay, and completed movement/dodge probes. `console.log` shows two `[A:error]` / `[B:error]` lines for HTTP 409 (Conflict) on a resource load during auth — expected when reusing an existing username, not an uncaught page exception. No infrastructure blocker.

Round-1 capture used the **fallback** full-flow smoke plan; it exercised login and lobby/gameplay but did not capture a dedicated registration-success screenshot.

## Per-criterion findings

### 1. After successful registration, user sees feedback (not a blank login form)

**Criterion (ticket):** Either registration auto-logs-in, **or** the login form visibly shows the success message after the swap.

**Finding: Met.** The register handler now calls `showLoginForm()` first, then writes `"Account created — please login"` into `#login-error` with green styling. Previously the same string was written to `#register-error` inside the hidden register form.

```3665:3670:game/client/main.js
			if (res.ok) {
				showLoginForm();
				if (loginErrorEl) {
					loginErrorEl.textContent = 'Account created — please login';
					loginErrorEl.style.color = '#4ade80';
				}
```

`#login-error` lives inside `#login-form` (see `index.html`); `showLoginForm()` removes `hidden` from the login form and adds it to the register form, so the message element is on-screen when the text is set. Order is correct: `showLoginForm()` clears `loginErrorEl` first, then the success text is applied immediately after.

### 2. Success message targets the visible element (`#login-error`, not `#register-error`)

**Finding: Met.** Success path uses `loginErrorEl` only. Failure and validation paths still use `registerErrorEl` unchanged (`Username and password are required`, `Registration failed`, network error).

### 3. Success styling distinguishes success from errors

**Finding: Met.** Inline color `#4ade80` is set on success. Default CSS for both error spans is `#fca5a5` (`style.css`).

### 4. No auto-login regression; auth flow unchanged otherwise

**Finding: Met.** Successful registration still does not call `/api/login` or `restoreSession`. Login button handler, token persistence, and `clearAuthForms()` on successful login are untouched. Server auth code was not modified.

### 5. Consistency with design / requirements

**Finding: Met.** `game/docs/design.md` has no auth-UI specifics; `game/docs/requirements.md` has no auth regression constraints. Change is a minimal client-only UX fix aligned with the playtest report.

### 6. Code quality and tests

**Finding: Met.** Single focused diff (4 lines moved/reordered in `game/client/main.js`). No dead code, no new debug scenarios, no socket/server changes.

Vitest: **303/303 passed** (`coverage.log`). No new unit test for the registration-success path, but existing auth form helpers (`showLoginForm`, `clearAuthForms`) remain covered.

### 7. Debug scenarios

**Finding: N/A.** No `?debugScenario=` or other debug shortcut was added or changed.

## Integration notes

- Sub-ticket `01-show-success-on-login-form` fully addresses the decomposed scope (one sub-ticket for this UI-only fix).
- Harness round-1 proof confirms the game runs end-to-end but does not visually prove the registration success message; code inspection and handler ordering confirm the fix for the reported repro.

## Remaining gaps

None blocking. All acceptance criteria are satisfied; runtime capture is clean.

VERDICT: PASS
