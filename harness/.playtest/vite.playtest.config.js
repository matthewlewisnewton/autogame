export default {
	server: {
		port: 5273,
		strictPort: true,
		proxy: {
			'/socket.io': {
				target: 'http://localhost:3901',
				ws: true
			}
		}
	}
};
