import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// main.js pulls in the GLTF loader transitively; stub it so importing the
// module in jsdom does not try to fetch real assets.
const gltfLoadMock = vi.hoisted(() => vi.fn());
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: vi.fn(function GLTFLoader() {
		this.load = gltfLoadMock;
	}),
}));

// DOM ids main.js expects to find on load. Mirrors the set used by the other
// main.js-loading tests, plus the level-map container added by this ticket.
const MAIN_DOM_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list', 'lobby-hud',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
	'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
	'lobby-currency-display', 'pending-trade-offer', 'pending-trade-text',
	'accept-trade-btn', 'reject-trade-btn', 'trade-target-select',
	'trade-offer-select', 'trade-request-select', 'offer-trade-btn',
	'level-map', 'quest-board', 'quest-board-wrapper', 'quest-briefing-panel',
	'quest-briefing', 'quest-error', 'booth-prompt', 'suspended-run-banner',
];

function ensureElement(id, tag = 'div') {
	if (document.getElementById(id)) return;
	const el = document.createElement(tag);
	el.id = id;
	document.body.appendChild(el);
}

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = id.endsWith('-btn')
			? 'button'
			: id.endsWith('-select')
				? 'select'
				: 'div';
		ensureElement(id, tag);
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

function stubLocalhostLocation() {
	const url = new URL('http://localhost:5173/');
	vi.stubGlobal('location', {
		hostname: 'localhost',
		host: 'localhost:5173',
		protocol: 'http:',
		search: url.search,
		href: url.href,
		pathname: url.pathname,
	});
}

// questUpdate-shaped payload carrying a ticket-388 levelUnlockGraph: a tier-1
// unlocked node, the tier-2 node it gates (locked), and a cleared boss node.
function levelGraphPayload(selectedQuestId, selectedQuestTier) {
	return {
		quests: [],
		selectedQuestId,
		selectedQuestTier,
		levelUnlockGraph: {
			nodes: [
				{
					questId: 'training_caverns', tier: 1, name: 'Initiate Vault',
					objectiveType: 'defeat_enemies', isBoss: false,
					unlockRequires: null, state: 'unlocked',
				},
				{
					questId: 'training_caverns', tier: 2, name: 'Initiate Vault II',
					objectiveType: 'defeat_enemies', isBoss: false,
					unlockRequires: [{ questId: 'training_caverns', tier: 1 }], state: 'locked',
				},
				{
					questId: 'arena_trials', tier: 1, name: 'Arena Apex',
					objectiveType: 'stage_boss', isBoss: true,
					unlockRequires: [{ questId: 'training_caverns', tier: 1 }], state: 'cleared',
				},
			],
		},
	};
}

function nodeFor(questId, tier) {
	return document.querySelector(
		`#level-map .level-map-node[data-quest-id="${questId}"][data-quest-tier="${tier}"]`,
	);
}

describe('level-map lobby integration (main.js)', () => {
	beforeEach(async () => {
		vi.resetModules();
		document.body.innerHTML = '';
		ensureMainDom();
		stubLocalhostLocation();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
		await import('../main.js');
		// Ensure a connected socket so node-selection emits are recorded.
		window.createSocket();
		window.__clearSocketEmitLog();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders nodes from the payload levelUnlockGraph through questUpdate', () => {
		window.__triggerSocketEvent('questUpdate', levelGraphPayload('training_caverns', 1));

		expect(window.__getLevelUnlockGraph()).toBeTruthy();
		const nodes = document.querySelectorAll('#level-map .level-map-node');
		expect(nodes.length).toBe(3);
		expect(nodeFor('training_caverns', 1)).toBeTruthy();
		expect(nodeFor('training_caverns', 2)).toBeTruthy();
		expect(nodeFor('arena_trials', 1)).toBeTruthy();
	});

	it('marks the node matching selectedQuestId/Tier as selected', () => {
		window.__triggerSocketEvent('questUpdate', levelGraphPayload('arena_trials', 1));

		expect(nodeFor('arena_trials', 1).classList.contains('selected')).toBe(true);
		expect(nodeFor('training_caverns', 1).classList.contains('selected')).toBe(false);
	});

	it('clicking an unlocked node emits SELECT_QUEST with that questId/tier', () => {
		window.__triggerSocketEvent('questUpdate', levelGraphPayload('training_caverns', 1));

		nodeFor('training_caverns', 1).click();

		const emits = window.__socketEmitLog().filter((e) => e.event === 'selectQuest');
		expect(emits.length).toBe(1);
		expect(emits[0].data).toEqual({ questId: 'training_caverns', tier: 1 });
	});

	it('clicking a locked node emits nothing', () => {
		window.__triggerSocketEvent('questUpdate', levelGraphPayload('training_caverns', 1));

		nodeFor('training_caverns', 2).click();

		expect(window.__socketEmitLog().filter((e) => e.event === 'selectQuest').length).toBe(0);
	});

	it('renders empty without throwing when no levelUnlockGraph is present', () => {
		window.__triggerSocketEvent('questUpdate', { quests: [], selectedQuestId: 'training_caverns' });

		expect(window.__getLevelUnlockGraph()).toBeNull();
		expect(document.querySelectorAll('#level-map .level-map-node').length).toBe(0);
	});
});
