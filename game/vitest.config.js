import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: 'server',
					include: [
						'server/test/**/*.{test,spec}.{js,mjs}'
					],
					environment: 'node'
				}
			},
			{
				test: {
					name: 'client',
					include: [
						'client/test/**/*.{test,spec}.{js,mjs}'
					],
					environment: 'jsdom',
					setupFiles: [
						'client/test/setup.js'
					]
				}
			}
		],
		hookTimeout: 30000,
		testTimeout: 30000,
		coverage: {
			provider: 'v8',
			reportsDirectory: './coverage',
			include: [
				'server/index.js',
				'server/progression.js',
				'server/simulation.js',
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
