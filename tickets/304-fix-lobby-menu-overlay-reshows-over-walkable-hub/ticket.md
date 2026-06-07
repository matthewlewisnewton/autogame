# 304-fix-lobby-menu-overlay-reshows-over-walkable-hub

## Difficulty: medium

## Goal

The hub validation (281, then 288) shows the 2D "Lobby Connection" menu overlay (card inventory / Photon Forge / Card Economy / Medic / Key Items tabs) DOMINATES the screen and obscures the walkable 3D ship hub (Quest Board / Launch Bay / Shop are only faintly visible behind it). In EVERY hub/room capture the menu is on top of the 3D space. 288s investigation (its qa.txt) identified a likely menu-overlay RE-SHOW bug: the lobby menu re-appears over the walkable hub even after dismissal (288 drafted a main.js lobby-dismiss guard but could not fully verify it). This defeats the PSO-style walkable hub — the player cannot see or move in the 3D space because the 2D lobby menu persistently covers it.

ROOT-CAUSE FIX (client): ensure the lobby/Lobby-Connection menu overlay stays DISMISSED while the player is walking the 3D hub. It should appear only when explicitly opened (at a station/booth or via a toggle), be dismissable, and STAY dismissed while walking — not persistently cover the hub. Investigate what re-opens/re-renders the overlay (the re-show trigger) and gate it. The walkable 3D hub — party-mate avatars, Quest Board, Launch Bay, Shop, the 3 rooms (operations/commerce/salon) — must be visible and navigable with the menu closed.

ACCEPTANCE: entering the hub shows the walkable 3D space with the menu NOT covering it; the lobby menu opens only on demand and stays dismissed while walking; party-mate avatars visible in 3D; client test for the dismiss / stays-dismissed behavior. SCOPE: game/client (lobby/hub overlay + main.js) + game/client/test. NOTE: this is the real fix behind the 288 recapture struggle; once this lands the walkable-hub recapture can pass.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
