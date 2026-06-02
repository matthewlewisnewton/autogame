## updateProfile partially mutates in-memory state when a later field fails validation

In `game/server/users.js`, `updateProfile` applies `username`/`email` changes to
the in-memory user record (and the `users` Map) *before* validating `cosmetic`.
If a request sends a valid username plus an invalid cosmetic, the function
returns `{ ok: false }` (route → 400) without calling `saveUsers`, but the
username/email change has already been committed in memory and will diverge from
disk until the next restart. In practice clients send valid combinations and the
route is the only caller, so impact is low — but validating all fields up front
(or rolling back on failure) would make the function atomic.

### Acceptance Criteria
- `updateProfile` leaves the in-memory user record unchanged when any provided
  field fails validation (no partial username/email mutation on a rejected
  cosmetic, and vice-versa).
- A test asserts that a request combining a valid username with an invalid
  cosmetic does not alter the stored username.
