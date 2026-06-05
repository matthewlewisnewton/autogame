/**
 * Shared context passed to every socket handler module's `register(socket, ctx)`.
 *
 * Identity fields are fixed per connection. Helpers are injected from index.js
 * so handlers do not close over module-level `io` or lobby utilities.
 *
 * @typedef {object} SocketContext
 * @property {import('socket.io').Socket} socket - The authenticated Socket.IO connection.
 * @property {string} playerId - Stable player id (same as accountId for JWT auth).
 * @property {string} accountId - Account id from the JWT.
 * @property {string} username - Display name from the JWT.
 * @property {object} sessionPlayer - Pre-lobby session snapshot built at connect time.
 * @property {(socket: import('socket.io').Socket, fn: Function) => *} withLobbyFromSocket
 *   Resolves the socket's lobby and runs `fn(state, lobby)` inside lobby context.
 * @property {(socket: import('socket.io').Socket, options: object, fn: Function) => *} withLobbyPlayer
 *   Like withLobbyFromSocket but also resolves the player and optional phase guards.
 * @property {(lobby: object, fn: Function) => *} withLobbyContext
 *   Runs `fn()` with simulation/progression state scoped to the lobby.
 * @property {(lobby: object) => void} broadcastLobbyUpdate
 *   Emits lobbyUpdate (and lobby list) for the given lobby.
 * @property {(playerId: string, excludeSocketId?: string) => import('socket.io').Socket|null} findSocketByPlayerId
 *   Finds a live socket by stable playerId.
 * @property {(playerId: string) => boolean} savePlayerData
 *   Persists the player's durable progress.
 * @property {import('socket.io').Server} io - Socket.IO server for room-scoped emits.
 * @property {(socket: import('socket.io').Socket, lobby: object, options?: object) => void} joinPlayerToLobby
 * @property {(socket: import('socket.io').Socket, lobby: object) => void} joinLobbyWithPhasePolicy
 * @property {(socket: import('socket.io').Socket) => *} leaveLobbyForSocket
 * @property {(socket: import('socket.io').Socket, lobby: object, explicitPlayerId?: string) => boolean} reconnectPlayerToLobby
 * @property {(state: object, questId: string) => void} applyLayoutForQuest
 * @property {(player: object) => object} buildSessionFromPlayer
 */

/**
 * Build the frozen context object consumed by handler `register` functions.
 *
 * @param {SocketContext} params
 * @returns {Readonly<SocketContext>}
 */
function createSocketContext({
  socket,
  playerId,
  accountId,
  username,
  sessionPlayer,
  withLobbyFromSocket,
  withLobbyPlayer,
  withLobbyContext,
  broadcastLobbyUpdate,
  findSocketByPlayerId,
  savePlayerData,
  io,
  joinPlayerToLobby,
  joinLobbyWithPhasePolicy,
  leaveLobbyForSocket,
  reconnectPlayerToLobby,
  applyLayoutForQuest,
  buildSessionFromPlayer,
}) {
  return Object.freeze({
    socket,
    playerId,
    accountId,
    username,
    sessionPlayer,
    withLobbyFromSocket,
    withLobbyPlayer,
    withLobbyContext,
    broadcastLobbyUpdate,
    findSocketByPlayerId,
    savePlayerData,
    io,
    joinPlayerToLobby,
    joinLobbyWithPhasePolicy,
    leaveLobbyForSocket,
    reconnectPlayerToLobby,
    applyLayoutForQuest,
    buildSessionFromPlayer,
  });
}

module.exports = { createSocketContext };
