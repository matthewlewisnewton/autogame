/**
 * Game server port for Vite dev proxy (/api, /socket.io).
 * Harness sets HARNESS_GAME_PORT; PORT is the usual Node convention.
 */
export function resolveGamePort(env = process.env) {
	const raw = env.HARNESS_GAME_PORT || env.PORT || 3000;
	const port = Number(raw);
	if (Number.isFinite(port) && port > 0) {
		return port;
	}
	return 3000;
}

const gamePort = resolveGamePort();

export default {
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			'/socket.io': {
				target: `http://localhost:${gamePort}`,
				ws: true
			},
			'/api': {
				target: `http://localhost:${gamePort}`
			}
		}
	}
};
