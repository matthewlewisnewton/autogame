# Auth (client): rely on httpOnly session cookie; stop storing/sending the JWT

## Difficulty: medium

## Goal

With server HTTP + socket auth now on session cookies, update the client to rely on the automatically-sent httpOnly cookie instead of a client-held JWT. Remove client-side token storage (localStorage/sessionStorage) and the Authorization: Bearer header / socket handshake auth token. Same-origin /api requests send the cookie automatically; socket.io connects without an explicit auth token (cookie rides the handshake). Update the login flow (it no longer reads a token from the login response — the server sets the cookie). Add a logout action calling POST /api/logout. Token handling lives in game/client (login/auth + socket setup e.g. createSocket in main.js + the lobby/login UI).

## Acceptance Criteria

- Client no longer stores a JWT (no localStorage/sessionStorage token); /api requests and socket.io auth succeed via the httpOnly session cookie alone; login works end-to-end (cookie set server-side); a logout action destroys the session; no Authorization Bearer or socket auth token is sent.

## Verification

qwen failed (rc=2)
