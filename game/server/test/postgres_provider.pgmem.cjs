'use strict';

const assert = require('node:assert/strict');
const { newDb } = require('pg-mem');
const { PostgresProvider } = require('../providers.js');
const { PLAYERS_SCHEMA_SQL, SETTINGS_SCHEMA_SQL } = require('../db/ensurePlayersSchema.js');

const sampleData = {
	currency: 42,
	ownedCards: { iron_sword: 2, fireball: 1 },
	selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
};

const sampleSettings = {
	soundEnabled: false,
	particlesEnabled: true,
	lockOnRepeatAction: 'cycle',
};

function createProvider() {
	const db = newDb();
	db.public.none(PLAYERS_SCHEMA_SQL);
	db.public.none(SETTINGS_SCHEMA_SQL);
	const { Pool } = db.adapters.createPg();
	const pool = new Pool();
	const provider = new PostgresProvider({ pool, skipSchemaEnsure: true });
	return { db, pool, provider };
}

function dispose({ pool, provider }) {
	provider.close();
	pool.end();
}

const cases = {
	'stores and retrieves player data': () => {
		const ctx = createProvider();
		try {
			ctx.provider.savePlayer('player1', sampleData);
			assert.deepEqual(ctx.provider.loadPlayer('player1'), sampleData);
		} finally {
			dispose(ctx);
		}
	},

	'returns null for unknown player': () => {
		const ctx = createProvider();
		try {
			assert.equal(ctx.provider.loadPlayer('nonexistent'), null);
		} finally {
			dispose(ctx);
		}
	},

	'overwrites data on subsequent saves': () => {
		const ctx = createProvider();
		try {
			ctx.provider.savePlayer('player1', sampleData);
			const updated = { ...sampleData, currency: 100 };
			ctx.provider.savePlayer('player1', updated);
			assert.deepEqual(ctx.provider.loadPlayer('player1'), updated);
		} finally {
			dispose(ctx);
		}
	},

	'isolates data between different players': () => {
		const ctx = createProvider();
		try {
			ctx.provider.savePlayer('player1', sampleData);
			ctx.provider.savePlayer('player2', { ...sampleData, currency: 99 });
			assert.equal(ctx.provider.loadPlayer('player1').currency, 42);
			assert.equal(ctx.provider.loadPlayer('player2').currency, 99);
		} finally {
			dispose(ctx);
		}
	},

	'save returns a deep copy (mutations do not affect stored data)': () => {
		const ctx = createProvider();
		try {
			const data = {
				currency: 42,
				ownedCards: { iron_sword: 2, fireball: 1 },
				selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
			};
			ctx.provider.savePlayer('player1', data);
			data.currency = 999;
			assert.equal(ctx.provider.loadPlayer('player1').currency, 42);
		} finally {
			dispose(ctx);
		}
	},

	'load returns a deep copy (mutations do not affect stored data)': () => {
		const ctx = createProvider();
		try {
			const data = { currency: 42, ownedCards: {}, selectedDeck: [] };
			ctx.provider.savePlayer('player1', data);
			const loaded = ctx.provider.loadPlayer('player1');
			loaded.currency = 999;
			assert.equal(ctx.provider.loadPlayer('player1').currency, 42);
		} finally {
			dispose(ctx);
		}
	},

	'close is a no-op when pool is injected': () => {
		const ctx = createProvider();
		try {
			assert.doesNotThrow(() => ctx.provider.close());
			ctx.provider.savePlayer('player1', sampleData);
			assert.deepEqual(ctx.provider.loadPlayer('player1'), sampleData);
		} finally {
			dispose(ctx);
		}
	},

	'rejects a traversal playerId on save': () => {
		const ctx = createProvider();
		try {
			assert.throws(
				() => ctx.provider.savePlayer('../escaped', sampleData),
				/Invalid player id/
			);
		} finally {
			dispose(ctx);
		}
	},

	'rejects a traversal playerId on load': () => {
		const ctx = createProvider();
		try {
			assert.throws(
				() => ctx.provider.loadPlayer('../../etc/foo'),
				/Invalid player id/
			);
		} finally {
			dispose(ctx);
		}
	},

	'rejects playerIds containing path separators or dots': () => {
		const ctx = createProvider();
		try {
			for (const bad of ['a/b', 'a.b', 'a\\b', '', '..']) {
				assert.throws(
					() => ctx.provider.savePlayer(bad, sampleData),
					/Invalid player id/
				);
			}
		} finally {
			dispose(ctx);
		}
	},

	'accepts UUID-shaped playerIds unchanged': () => {
		const ctx = createProvider();
		try {
			const uuid = '550e8400-e29b-41d4-a716-446655440000';
			ctx.provider.savePlayer(uuid, sampleData);
			assert.deepEqual(ctx.provider.loadPlayer(uuid), sampleData);
		} finally {
			dispose(ctx);
		}
	},

	// ── Settings ──

	'stores and retrieves settings': () => {
		const ctx = createProvider();
		try {
			ctx.provider.saveSettings('acct1', sampleSettings);
			assert.deepEqual(ctx.provider.loadSettings('acct1'), sampleSettings);
		} finally {
			dispose(ctx);
		}
	},

	'returns null for unknown settings accountId': () => {
		const ctx = createProvider();
		try {
			assert.equal(ctx.provider.loadSettings('nonexistent'), null);
		} finally {
			dispose(ctx);
		}
	},

	'overwrites settings on subsequent saves': () => {
		const ctx = createProvider();
		try {
			ctx.provider.saveSettings('acct1', sampleSettings);
			const updated = { ...sampleSettings, soundEnabled: true };
			ctx.provider.saveSettings('acct1', updated);
			assert.deepEqual(ctx.provider.loadSettings('acct1'), updated);
		} finally {
			dispose(ctx);
		}
	},

	'isolates settings between different accounts': () => {
		const ctx = createProvider();
		try {
			ctx.provider.saveSettings('acct1', sampleSettings);
			ctx.provider.saveSettings('acct2', { ...sampleSettings, soundEnabled: true });
			assert.equal(ctx.provider.loadSettings('acct1').soundEnabled, false);
			assert.equal(ctx.provider.loadSettings('acct2').soundEnabled, true);
		} finally {
			dispose(ctx);
		}
	},

	'settings are independent from player data': () => {
		const ctx = createProvider();
		try {
			ctx.provider.savePlayer('acct1', sampleData);
			ctx.provider.saveSettings('acct1', sampleSettings);
			assert.deepEqual(ctx.provider.loadPlayer('acct1'), sampleData);
			assert.deepEqual(ctx.provider.loadSettings('acct1'), sampleSettings);
		} finally {
			dispose(ctx);
		}
	},

	'rejects a traversal accountId on settings save': () => {
		const ctx = createProvider();
		try {
			assert.throws(
				() => ctx.provider.saveSettings('../escaped', sampleSettings),
				/Invalid player id/
			);
		} finally {
			dispose(ctx);
		}
	},

	'rejects a traversal accountId on settings load': () => {
		const ctx = createProvider();
		try {
			assert.throws(
				() => ctx.provider.loadSettings('../../etc/foo'),
				/Invalid player id/
			);
		} finally {
			dispose(ctx);
		}
	},
};

const only = process.argv[2];
const toRun = only ? { [only]: cases[only] } : cases;

for (const [name, fn] of Object.entries(toRun)) {
	if (!fn) {
		console.error(`Unknown case: ${only}`);
		process.exit(1);
	}
	try {
		fn();
	} catch (err) {
		console.error(`FAIL: ${name}`);
		console.error(err);
		process.exit(1);
	}
}
