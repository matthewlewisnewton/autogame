// Canonical Socket.IO event name registry (wire strings live in events.json).
const { serverToClient, clientToServer } = require('./events.json');

module.exports = {
  serverToClient,
  clientToServer,
  SERVER_TO_CLIENT: serverToClient,
  CLIENT_TO_SERVER: clientToServer,
};
