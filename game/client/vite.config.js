const gamePort = Number(process.env.HARNESS_GAME_PORT || process.env.PORT || 3000);
const proxyTarget = `http://localhost:${gamePort}`;

export default {
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			'/socket.io': {
				target: proxyTarget,
				ws: true
			},
			'/api': {
				target: proxyTarget
			}
		}
	}
};
