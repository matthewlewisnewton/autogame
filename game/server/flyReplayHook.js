const { isFlyReplayEnabled } = require('./flyReplay');

const LOBBY_QUERY_KEYS = ['lobbyId', 'lobby', 'joinLobby'];

let _attached = false;

function parseLobbyIdFromUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return null;
  }
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }
  const params = new URLSearchParams(url.slice(queryIndex + 1));
  for (const key of LOBBY_QUERY_KEYS) {
    const value = params.get(key);
    if (value == null) {
      continue;
    }
    const normalized = String(value).trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return null;
}

function isSocketIoPath(url) {
  return typeof url === 'string' && url.startsWith('/socket.io');
}

function sendFlyReplayResponse(rawSocket, machineId) {
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    `fly-replay: instance=${machineId}`,
    '',
    '',
  ];
  rawSocket.end(headers.join('\r\n'));
}

async function handleLobbyRouting(lobbyId) {
  const routing = await require('./flyReplay').resolveLobbyRouting(lobbyId);
  if (routing.action === 'replay') {
    return { replay: true, machineId: routing.machineId };
  }
  if (routing.action === 'self' && routing.claimOwner) {
    const lobby = require('./lobbies').getLobbyById(lobbyId);
    if (lobby) {
      require('./lobbyRegistry').registerLobby(lobbyId).catch((err) => {
        console.error('[flyReplayHook] registerLobby failed:', err);
      });
    }
  }
  return { replay: false };
}

function beginLobbyRouting(req, lobbyId) {
  if (!req._flyReplayRoutingPromise) {
    req._flyReplayRoutingPromise = handleLobbyRouting(lobbyId);
  }
  return req._flyReplayRoutingPromise;
}

function createFlyReplayMiddleware() {
  return function flyReplayMiddleware(req, res, next) {
    const lobbyId = parseLobbyIdFromUrl(req.url);
    if (!lobbyId && !req._flyReplayRoutingPromise) {
      return next();
    }

    const routingPromise = req._flyReplayRoutingPromise || beginLobbyRouting(req, lobbyId);
    void routingPromise
      .then((result) => {
        if (result.replay) {
          const rawSocket = res.socket || req.socket;
          sendFlyReplayResponse(rawSocket, result.machineId);
          return;
        }
        next();
      })
      .catch((err) => {
        console.error('[flyReplayHook] routing failed:', err);
        next(err);
      });
  };
}

function createUpgradeHandler(io) {
  return function flyReplayUpgradeHandler(req, socket, _head) {
    if (req.headers.upgrade !== 'websocket') {
      return;
    }
    if (!isSocketIoPath(req.url)) {
      return;
    }

    const lobbyId = parseLobbyIdFromUrl(req.url);
    if (!lobbyId) {
      return;
    }

    const routingPromise = beginLobbyRouting(req, lobbyId);

    // Standalone servers (unit tests) have no Socket.IO engine middleware.
    if (!io || !io.engine) {
      void routingPromise.then((result) => {
        if (result.replay) {
          sendFlyReplayResponse(socket, result.machineId);
        }
      }).catch((err) => {
        console.error('[flyReplayHook] upgrade routing failed:', err);
        socket.destroy();
      });
    }
  };
}

function attachFlyReplayRouting(server, app, io) {
  if (_attached || !isFlyReplayEnabled()) {
    return;
  }
  _attached = true;

  const middleware = createFlyReplayMiddleware();
  app.use(middleware);

  if (io && io.engine) {
    io.engine.use(middleware);
  }

  server.prependListener('upgrade', createUpgradeHandler(io));
}

function resetFlyReplayHookForTests() {
  _attached = false;
}

module.exports = {
  attachFlyReplayRouting,
  parseLobbyIdFromUrl,
  sendFlyReplayResponse,
  resetFlyReplayHookForTests,
};
