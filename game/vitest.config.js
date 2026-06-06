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
					environment: 'node',
					// Run server test files in parallel. Each file gets its own
					// isolated worker process, so the module-level singletons in
					// index.js (httpServer/io) are per-file, and every suite binds
					// an ephemeral port (0) — parallel files cannot collide on a
					// port or on each other's state. The few suites that touch the
					// filesystem (auth/account/users/cosmetic) point persistence at
					// their own unique temp paths, so disk writes stay isolated too.
					// This is the primary fix for the coverage run blowing past the
					// 120s budget while crawling through the suite serially.
					fileParallelism: true,
					minWorkers: 1,
					maxWorkers: 4,
				}
			},
			{
				test: {
					name: 'client',
					include: [
						'client/test/**/*.{test,spec}.{js,mjs}'
					],
					exclude: [
						'client/test/playerModel.test.js'
					],
					environment: 'jsdom',
					setupFiles: [
						'client/test/setup.js'
					]
				}
			},
			{
				test: {
					name: 'client-glb',
					include: [
						'client/test/playerModel.test.js'
					],
					environment: 'node',
					fileParallelism: false,
					maxWorkers: 1,
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
				'client/cardRenderers.js',
				'client/collision.js',
				'client/hand.js',
				'client/delta.js'
			],
			thresholds: {
				// Server monoliths (index/progression/simulation) cap blended coverage
				// near ~64%; client modules stay ~92%. Harness coverage runs disable
				// thresholds; these floors match the committed suite as of ticket 303.
				statements: 64,
				branches: 70,
				functions: 60,
				lines: 64
			}
		}
	}
});
