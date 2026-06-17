// E2E: lobby registry + pub/sub against a REAL Redis (REDIS_URL from setup.e2e.js).
//
// Plain Node script (async IIFE) for consistency with postgres.e2e.cjs. Exercises
// the production cross-instance paths the in-memory shim only approximates: the
// lobby-owner registry (hset/hget/hdel) and pub/sub (the substrate the socket.io
// Redis adapter rides on).
require('./setup.e2e.js');
const assert = require('node:assert/strict');
const redis = require('../redis.js');
const registry = require('../lobbyRegistry.js');

let pass = 0;
let fail = 0;
async function check(name, fn) {
	try {
		await fn();
		console.log(`  ok   - ${name}`);
		pass++;
	} catch (e) {
		console.error(`  FAIL - ${name}: ${e.message}`);
		fail++;
	}
}

(async () => {
	// REDIS_URL is set, so getRedisClient()/createPubSubClients() use real ioredis.
	assert.equal(redis.isRedisEnabled(), true);
	await registry.resetLobbyRegistryForTests();

	await check('registers, looks up, and removes a lobby owner', async () => {
		process.env.INSTANCE_ID = 'instance-A';
		try {
			const owner = await registry.registerLobby('lobby-1');
			assert.equal(owner, 'instance-A');
			assert.equal(await registry.getLobbyOwner('lobby-1'), 'instance-A');
			await registry.unregisterLobby('lobby-1');
			assert.equal(await registry.getLobbyOwner('lobby-1'), null);
		} finally {
			delete process.env.INSTANCE_ID;
		}
	});

	await check('a second instance reads the first instance’s lobby ownership', async () => {
		await registry.resetLobbyRegistryForTests();
		process.env.INSTANCE_ID = 'instance-A';
		await registry.registerLobby('lobby-shared');
		// Instance B (same Redis) sees A as owner — basis for Fly-Replay routing to
		// the machine holding the lobby's in-memory game state.
		process.env.INSTANCE_ID = 'instance-B';
		try {
			assert.equal(await registry.getLobbyOwner('lobby-shared'), 'instance-A');
		} finally {
			delete process.env.INSTANCE_ID;
		}
	});

	await check('delivers a pub/sub message between two real Redis clients', async () => {
		const { pubClient, subClient } = redis.createPubSubClients();
		const received = new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('pub/sub message not received within 5s')), 5000);
			subClient.on('message', (channel, message) => {
				if (channel === 'e2e-broadcast') {
					clearTimeout(timer);
					resolve(message);
				}
			});
		});
		await subClient.subscribe('e2e-broadcast');
		await pubClient.publish('e2e-broadcast', 'hello-across-instances');
		assert.equal(await received, 'hello-across-instances');
	});

	await registry.resetLobbyRegistryForTests();
	redis.closeRedis();
	console.log(`redis e2e: ${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
})();
