# Round 1 — kickoff

This is the first loop round. The repo already contains a minimal foundation:
a Three.js client (`client/main.js`) and a socket.io server (`server/index.js`)
with WASD movement broadcast.

Your task: review the code against the active milestone in
`docs/requirements.md` (Milestone 1 — Foundation) and fix anything that does
not fully and robustly meet it. In particular make sure:

- the 3D scene renders reliably with no console/runtime errors;
- the client connects to the server and shows a clear "Connected" status in
  the UI;
- multiple connected players each appear as a distinct object — a second
  client must be visible to the first;
- WASD movement updates the local player AND is broadcast so other clients see
  the movement (check that remote players actually move on screen).

Keep changes minimal — the foundation is close. Do not start later milestones.
