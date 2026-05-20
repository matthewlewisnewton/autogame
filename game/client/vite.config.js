export default {
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			'/socket.io': {
				target: 'http://localhost:3000',
				ws: true
			}
		}
	}
}
