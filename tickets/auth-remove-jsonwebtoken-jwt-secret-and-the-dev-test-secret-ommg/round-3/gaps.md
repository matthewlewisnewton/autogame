1. Dead/broken JWT-path code remains: `harness/validate/lib/auth.mjs` still does
   JWT token injection. `registerUser()` reads `body.token` (removed from the
   server response by this ticket → always undefined → throws "Auth failed");
   `injectToken()` sets `localStorage('autogame_token')`, which no client code
   reads. This breaks `harness/validate/playthrough.mjs` (`npm run
   validate:playthrough`) and violates the "no dead JWT references" AC.
   Files: harness/validate/lib/auth.mjs, harness/validate/playthrough.mjs
   Fix: migrate to session-cookie auth mirroring
   game/client/scripts/session-auth.mjs — register/login in-page via fetch with
   `credentials: 'include'` so the `ag_session` cookie is set, reload, and wait
   for connected; remove the `body.token` return and the `autogame_token`
   localStorage injection. Update `playthrough.mjs` for the new helper signature.
