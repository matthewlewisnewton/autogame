import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'server/test/**/*.{test,spec}.{js,mjs}',
			'client/test/**/*.{test,spec}.{js,mjs}'
		],
		environments: {
			'client/test/**': 'jsdom',
			'server/test/**': 'node'
		}
	}
});
