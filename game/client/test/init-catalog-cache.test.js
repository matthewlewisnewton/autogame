import { beforeEach, describe, expect, it } from 'vitest';
import { bindInitHandlers } from '../socketHandlers/initHandlers.js';

function bind(ctx) {
	const handlers = new Map();
	const socket = {
		on(event, handler) {
			handlers.set(event, handler);
		},
	};
	const boundCtx = {
		rendererSetMyId() {},
		renderDeckEditor() {},
		setLoggedInStatus() {},
		showAppToolbar() {},
		showLobbyBrowser() {},
		renderLobbyList() {},
		showLobbyBrowserError() {},
		handleLobbyDeepLinkAfterInit() {},
		emitPendingLobbyJoin() {},
		isCurrentSocket() { return true; },
		STORAGE_KEY_PLAYER_ID: 'test-player-id',
		...ctx,
	};
	bindInitHandlers(socket, boundCtx);
	return {
		ctx: boundCtx,
		emitInit: (payload) => handlers.get('init')(payload),
	};
}

describe('INIT catalog cache', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('stores catalogs received with a new hash', () => {
		const { ctx, emitInit } = bind({});
		emitInit({
			id: 'p1',
			catalogHash: 'hash-1',
			keyItemDefs: { dodge_roll: { cooldownMs: 1000 } },
			enemyDisplayCatalog: { grunt: { name: 'Grunt' } },
		});

		expect(JSON.parse(localStorage.getItem('ag_key_item_defs'))).toEqual(ctx.keyItemDefs);
		expect(JSON.parse(localStorage.getItem('ag_enemy_display_catalog'))).toEqual(ctx.enemyDisplayCatalog);
		expect(localStorage.getItem('ag_catalog_hash')).toBe('hash-1');
	});

	it('hydrates catalogs when the server accepts the cached hash', () => {
		localStorage.setItem('ag_key_item_defs', JSON.stringify({ guard_block: { cooldownMs: 2000 } }));
		localStorage.setItem('ag_enemy_display_catalog', JSON.stringify({ boss: { name: 'Boss' } }));
		const { ctx, emitInit } = bind({});
		emitInit({ id: 'p1', catalogHash: 'hash-1' });

		expect(ctx.keyItemDefs).toEqual({ guard_block: { cooldownMs: 2000 } });
		expect(ctx.enemyDisplayCatalog).toEqual({ boss: { name: 'Boss' } });
	});
});
