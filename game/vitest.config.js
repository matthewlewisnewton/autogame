import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: [
			'server/test/**/*.{test,spec}.{js,mjs}',
			'client/test/**/*.{test,spec}.{js,mjs}'
		],
		environmentMatchGlobs: [
			['client/test/**', 'jsdom'],
			['server/test/**', 'node']
		],
		setupFiles: [
			'client/test/setup.js'
		],
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			include: [
				'server/index.js',
				'client/cards.js',
				'client/collision.js',
				'client/hand.js',
				'client/delta.js'
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
