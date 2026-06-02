// The backend port is fixed at 3000 in normal local dev, but each parallel
// harness worker runs its game server on its OWN allocated port (passed as
// HARNESS_GAME_PORT). Hardcoding 3000 made every non-3000 worker's /api +
// /socket.io proxy hit the wrong server (or ECONNREFUSED), which broke the
// capture step and force-failed its review. Honor the allocated port.
const apiTarget = `http://localhost:${process.env.HARNESS_GAME_PORT || process.env.PORT || 3000}`;

export default {
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			'/socket.io': {
				target: apiTarget,
				ws: true
			},
			'/api': {
				target: apiTarget
			}
		}
	}
}
