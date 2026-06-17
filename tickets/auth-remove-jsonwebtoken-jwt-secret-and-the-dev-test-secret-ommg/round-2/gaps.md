1. `gameplay-review.md` documents the removed JWT flow as current behavior. The
   "Authentication and lobby browser" paragraph says the client "stores the returned JWT" and
   "The server validates the token in middleware ... invalid tokens produce a `connect_error`".
   Auth is now session-cookie based; there is no JWT/token.
   Files: game/docs/gameplay-review.md (~L9)
   Fix: rewrite the paragraph to describe httpOnly `ag_session` cookie auth — `/api/login` sets
   the cookie, the Socket.IO `io.use()` middleware validates it via `getSession()`, and an
   invalid/missing session yields `connect_error`.

2. `lobbies.md` still says lobby handshakes are "routed before JWT auth".
   Files: game/docs/lobbies.md (~L131)
   Fix: change "before JWT auth" to "before session auth" (or "before the session-cookie auth
   middleware").

3. `admin.js` comments reference the removed "player JWT auth" / "player JWT / `Authorization:
   Bearer` header" when contrasting admin auth.
   Files: game/server/admin.js (~L3, ~L201)
   Fix: update the comments to say the player **session** auth (the `ag_session` cookie); drop
   the stale `Authorization: Bearer`/JWT wording.
