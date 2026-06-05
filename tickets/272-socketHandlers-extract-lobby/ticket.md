# 272-socketHandlers-extract-lobby

## Difficulty: medium

## Goal

Slice 1 of the index.js socket-closure extraction (210 was too big to land atomically). Move the LOBBY/run socket.on handlers from the io.on('connection') closure (index.js:1102-1942) into server/socketHandlers/lobbyHandlers.js, each register(socket,ctx) with ctx bundling identity+helpers.

## Acceptance Criteria

- Lobby handlers moved into a module + registered via ctx; behaviour-preserving; server test suite green.

## Verification

merge rejected: post-rebase verification failed
