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
					testTimeout: 30000,
					hookTimeout: 30000,
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
			},
			{
				test: {
					name: 'harness',
					include: [
						'../harness/validate/lib/**/*.test.{js,mjs}'
					],
					environment: 'node',
				}
			}
		],
		hookTimeout: 30000,
		testTimeout: 30000,
		coverage: {
			provider: 'v8',
			// AST-aware remapping keeps coverage merging coherent when the same CJS
			// module is loaded both vite-transformed (ESM import) and natively
			// (createRequire) across the parallel per-file workers. Without it the
			// per-process istanbul merges mismatch function/branch maps and the
			// merged report saturates around a fixed point that no longer responds
			// to real tests (verified: +50 direct helper unit tests moved global
			// function coverage by 0.0%). Branch counting is stricter under this
			// mode (implicit else / default params / ?? count as branch points), so
			// the branch threshold below is calibrated against the accurate basis.
			experimentalAstAwareRemapping: true,
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
				statements: 70,
				// Branch counting under AST-aware remapping is stricter than the old
				// (incoherently merged) basis that reported ~85%: accurately measured,
				// the suite sits at ~64.5% branches (vs ~76% statements / ~74.6%
				// functions / ~78% lines). 60 keeps comparable regression headroom to
				// the other three metrics on the accurate basis; ratchet it up as
				// branch coverage grows.
				branches: 60,
				functions: 70,
				lines: 70
			}
		}
	}
});
