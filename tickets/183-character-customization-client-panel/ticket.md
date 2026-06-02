# 183 — Character Customization: Client Panel

Lobby/account customization panel letting players choose body color, accent color,
and body shape with a live preview, saved via `PATCH /api/me/profile`. Surfaces
the Phase-A cosmetic options from ticket 181 to players.

Depends on **181-character-customization-server-cosmetic-profile** (server
`cosmetic` profile + snapshot fields). In-world 3D avatar rendering is ticket
**182**; this ticket covers the UI, persistence, HUD portrait, and applying the
saved cosmetic to the local runtime player record.

## Acceptance Criteria
- Panel offers a body color palette, an accent color picker, and a body shape
  picker (`box`, `cylinder`, `cone`, `capsule`).
- Live preview in the panel reflects the current control selection before save.
- **Save** persists via `PATCH /api/me/profile` with server validation; errors
  surface in the panel.
- Selection survives a full page reload (`GET /api/me`) and is reflected on the
  Vanguard HUD portrait (`#character-frame`).
- When connected in a run, the local player's `cosmetic` on `gameState` matches
  the saved profile after save (ready for ticket 182 rendering).
- Panel lives in the existing **Account** overlay (`#account-overlay`), alongside
  the username controls and the separate Settings overlay.

## Design
- Reuse `patchProfile` / `loadAccountSettings` in `game/client/settings.js`.
- Mirror server defaults and `BODY_SHAPES` from `game/server/cosmetic.js`.
- DOM preview only (no Three.js in this ticket).
