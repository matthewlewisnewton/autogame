import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHub } from '../../server/dungeon.js';

// Exercises the renderer contract that main.js relies on after applyHubPresence
// merges hub-presence entries into gameState.players during the lobby phase.

const NON_DEFAULT_COSMETIC = {
	bodyColor: '#ff00aa',
	accentColor: '#33cc33',
	bodyShape: 'cylinder',
	hat: 'wizard',
};

const ALT_COSMETIC = {
	bodyColor: '#224466',
	accentColor: '#aabbcc',
	bodyShape: 'cone',
	hat: 'crown',
};

/** Mirror renderer cosmeticSignature() for assertion keys. */
function expectedCosmeticKey(cosmetic) {
	const shapes = new Set(['box', 'cylinder', 'cone', 'capsule']);
	const hats = new Set(['none', 'cap', 'wizard', 'crown', 'bandana', 'beanie']);
	const hexRe = /^#[0-9a-f]{6}$/i;
	const shape = shapes.has(cosmetic.bodyShape) ? cosmetic.bodyShape : 'box';
	const body = (typeof cosmetic.bodyColor === 'string' && hexRe.test(cosmetic.bodyColor))
		? cosmetic.bodyColor.toLowerCase()
		: 'default';
	const accent = (typeof cosmetic.accentColor === 'string' && hexRe.test(cosmetic.accentColor))
		? cosmetic.accentColor.toLowerCase()
		: 'default';
	const hat = hats.has(cosmetic.hat) ? cosmetic.hat : 'none';
	return `${shape}|${body}|${accent}|${hat}|player`;
}

function hubPresenceEntry(id, pos, cosmetic, username) {
	return {
		id,
		x: pos.x,
		y: 0.5,
		z: pos.z,
		rotation: 0,
		cosmetic,
		username,
		connected: true,
	};
}

/** Minimal DOM that main.js expects at module load (see main.test.js). */
function ensureMainDomElements() {
	const requiredIds = [
		'status', 'vanguard-hud', 'character-id', 'player-level',
		'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
		'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
		'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
		'currency-display', 'objective-hud', 'ui', 'card-hand',
		'lobby', 'lobby-browser', 'lobby-player-list',
		'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
		'summary-currency', 'summary-rewards', 'summary-rewards-currency',
		'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
		'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
		'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
		'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
		'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
		'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
	];
	for (const id of requiredIds) {
		if (!document.getElementById(id)) {
			const el = (id === 'return-to-lobby-btn'
				|| id === 'accept-trade-btn' || id === 'reject-trade-btn' || id === 'offer-trade-btn')
				? document.createElement('button')
				: id === 'trade-target-select' || id === 'trade-offer-select' || id === 'trade-request-select'
					? document.createElement('select')
					: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
	}
	const cardHand = document.getElementById('card-hand');
	if (cardHand && cardHand.querySelectorAll('.card-slot').length === 0) {
		for (let i = 0; i < 6; i++) {
			const slot = document.createElement('div');
			slot.className = 'card-slot';
			slot.dataset.slotIndex = String(i);
			cardHand.appendChild(slot);
		}
	}
}

function lobbyGameStateForMain(hubLayout, hubSpawn) {
	return {
		gamePhase: 'lobby',
		layout: hubLayout,
		players: {
			p1: {
				id: 'p1',
				x: hubSpawn.x,
				z: hubSpawn.z,
				y: 0.5,
				hp: 100,
				dead: false,
				cosmetic: { bodyShape: 'box', hat: 'none' },
			},
		},
		loot: [],
		enemies: [],
		minions: [],
	};
}

function startCenter(layout) {
	const start = layout.rooms.find((r) => r.role === 'start') || layout.rooms[0];
	return { x: start.x, z: start.z };
}

function lobbyPlayerState(hubLayout, myId, remoteId, remotePos) {
	return {
		gamePhase: 'lobby',
		layout: hubLayout,
		players: {
			[myId]: {
				id: myId,
				x: startCenter(hubLayout).x,
				z: startCenter(hubLayout).z,
				y: 0.5,
				hp: 100,
				dead: false,
				cosmetic: { bodyShape: 'box', hat: 'none' },
			},
			[remoteId]: {
				id: remoteId,
				x: remotePos.x,
				z: remotePos.z,
				y: 0.5,
				rotation: 0,
				hp: 100,
				dead: false,
				cosmetic: NON_DEFAULT_COSMETIC,
			},
		},
		loot: [],
		enemies: [],
		minions: [],
	};
}

describe('hub presence avatars (lobby)', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		window.__soundLogEnabled = true;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	it('builds meshes for local and remote lobby players', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteSpawn = { x: hubSpawn.x + 4, z: hubSpawn.z + 2 };

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			animate,
			getMeshMaps,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);
		setGameStateRef(lobbyPlayerState(hubLayout, 'p1', 'p2', remoteSpawn));

		animate(0);

		const meshes = getMeshMaps().playersMeshes;
		expect(meshes.p1).toBeTruthy();
		expect(meshes.p2).toBeTruthy();
		expect(meshes.p2.position.x).toBeCloseTo(remoteSpawn.x, 5);
		expect(meshes.p2.position.z).toBeCloseTo(remoteSpawn.z, 5);
		expect(meshes.p2.userData.hatId).toBe('wizard');
	});

	it('moves the remote mesh when hub presence coordinates change', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteStart = { x: hubSpawn.x + 2, z: hubSpawn.z };
		const remoteMoved = { x: hubSpawn.x + 8, z: hubSpawn.z + 5 };

		const {
			initScene,
			setGameStateRef,
			setMyId,
			setGamePhase,
			setPlayerPosition,
			animate,
			getMeshMaps,
		} = await import('../renderer.js');

		setGamePhase('lobby');
		initScene(hubLayout, { x: 0, z: 0 });
		setMyId('p1');
		setPlayerPosition(hubSpawn.x, hubSpawn.z);

		const gs = lobbyPlayerState(hubLayout, 'p1', 'p2', remoteStart);
		setGameStateRef(gs);
		animate(0);

		const remoteMesh = getMeshMaps().playersMeshes.p2;
		expect(remoteMesh.position.x).toBeCloseTo(remoteStart.x, 5);
		expect(remoteMesh.position.z).toBeCloseTo(remoteStart.z, 5);

		gs.players.p2.x = remoteMoved.x;
		gs.players.p2.z = remoteMoved.z;
		setGameStateRef(gs);
		animate(16);

		expect(remoteMesh.position.x).toBeCloseTo(remoteMoved.x, 5);
		expect(remoteMesh.position.z).toBeCloseTo(remoteMoved.z, 5);
	});

	it('applyHubPresence sequence updates remote mesh position and cosmeticKey', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteStart = { x: hubSpawn.x + 2, z: hubSpawn.z };
		const remoteMoved = { x: hubSpawn.x + 8, z: hubSpawn.z + 5 };

		ensureMainDomElements();
		await import('../main.js');
		window.initScene(hubLayout, { x: 0, z: 0 });
		window.__setGameState(lobbyGameStateForMain(hubLayout, hubSpawn), 'p1');

		const { animate, getMeshMaps } = await import('../renderer.js');

		window.applyHubPresence({
			schemaVersion: 1,
			entries: {
				p2: hubPresenceEntry('p2', remoteStart, NON_DEFAULT_COSMETIC),
			},
		});
		animate(0);

		const remoteMesh = getMeshMaps().playersMeshes.p2;
		expect(remoteMesh).toBeTruthy();
		expect(remoteMesh.position.x).toBeCloseTo(remoteStart.x, 5);
		expect(remoteMesh.userData.cosmeticKey).toBe(expectedCosmeticKey(NON_DEFAULT_COSMETIC));

		window.applyHubPresence({
			schemaVersion: 1,
			entries: {
				p2: hubPresenceEntry('p2', remoteMoved, ALT_COSMETIC),
			},
		});
		animate(16);

		const updatedMesh = getMeshMaps().playersMeshes.p2;
		expect(updatedMesh).toBeTruthy();
		expect(updatedMesh.position.x).toBeCloseTo(remoteMoved.x, 5);
		expect(updatedMesh.position.z).toBeCloseTo(remoteMoved.z, 5);
		expect(updatedMesh.userData.cosmeticKey).toBe(expectedCosmeticKey(ALT_COSMETIC));
	});

	it('applyHubPresence removedPlayerIds disposes remote avatar mesh', async () => {
		const hubLayout = generateHub(0);
		const hubSpawn = startCenter(hubLayout);
		const remoteSpawn = { x: hubSpawn.x + 3, z: hubSpawn.z + 1 };

		ensureMainDomElements();
		await import('../main.js');
		window.initScene(hubLayout, { x: 0, z: 0 });
		window.__setGameState(lobbyGameStateForMain(hubLayout, hubSpawn), 'p1');

		const { animate, getMeshMaps } = await import('../renderer.js');

		window.applyHubPresence({
			schemaVersion: 1,
			entries: {
				p2: hubPresenceEntry('p2', remoteSpawn, NON_DEFAULT_COSMETIC),
			},
		});
		animate(0);
		expect(getMeshMaps().playersMeshes.p2).toBeTruthy();

		window.applyHubPresence(
			{ schemaVersion: 1, entries: {} },
			{ removedPlayerIds: ['p2'] },
		);
		animate(16);

		expect(getMeshMaps().playersMeshes.p2).toBeUndefined();
	});
});
