1. Login broken in the running game: `/api/login` and `/api/register` no longer
   return a `token`, but the client login handler requires `data.token` to
   create the socket, and the Socket.IO handshake still authenticates with the
   JWT. Players can't log in or reach the lobby (capture timed out).
   Files: game/server/auth.js (lines ~217-219, ~266-268), game/client/main.js (line ~3859), game/server/index.js (line ~1937).
   Fix: keep returning the JWT `token` in the login/register response body in
   addition to `Set-Cookie` (cookie stays primary for HTTP requireAuth) so the
   still-JWT socket/client path keeps working until the socket-migration bead.
