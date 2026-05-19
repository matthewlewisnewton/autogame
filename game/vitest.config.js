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
		},
		setupFiles: [
			'client/test/setup.js'
		],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			include: [
				'server/index.js',
				'client/cards.js',
				'client/main.js'
			],
			thresholds: {
				statements: 70,
				branches: 70,
				functions: 70,
				lines: 70
			}
		}
	}
});
