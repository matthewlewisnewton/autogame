1. Free appearance-edit bypass remains through the Account profile cosmetic save.
   Files: game/client/main.js, game/client/index.html, game/client/settings.js, game/server/account.js, game/server/users.js
   Fix: remove/disable paid appearance fields from the Account profile save path or route all cosmetic appearance writes through the same charged server-side flow as `applyAppearance`; keep hat-only swaps free and add regression coverage proving `/api/me/profile` cannot change paid appearance fields for free.
