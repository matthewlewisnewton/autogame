import { describe, it, expect, beforeEach } from 'vitest';
import {
	buildDeckMiniEntries,
	computeRunDeckTotal,
	deckIdsForDisplay,
	formatDeckCountLabel,
	formatDesperationDeckCountLabel,
	getDeckStackLayerCount,
	resolveDeckCardId,
} from '../deck-viewer.js';
import { deck, resetHandState, setDrawPile } from '../hand.js';

describe('resolveDeckCardId()', () => {
	it('returns known card ids', () => {
		expect(resolveDeckCardId('iron_sword')).toBe('iron_sword');
		expect(resolveDeckCardId('steel_claymore')).toBe('steel_claymore');
		expect(resolveDeckCardId('rusty_shiv')).toBe('rusty_shiv');
	});

	it('returns null for unknown entries', () => {
		expect(resolveDeckCardId('nonexistent_card')).toBeNull();
		expect(resolveDeckCardId(null)).toBeNull();
	});

	it('maps legacy evolved card ids from pre-rename saves', () => {
		expect(resolveDeckCardId('steel_broadsword')).toBe('steel_claymore');
		expect(resolveDeckCardId('inferno_edge')).toBe('magma_greatsword');
		expect(resolveDeckCardId('guardian_familiar')).toBe('astral_guardian');
		expect(resolveDeckCardId('ancient_drake')).toBe('ancient_wyrm');
	});
});

describe('buildDeckMiniEntries()', () => {
	it('maps deck ids to icon/name/type styling metadata', () => {
		const entries = buildDeckMiniEntries(['iron_sword', 'battle_familiar', 'dungeon_drake']);
		expect(entries).toHaveLength(3);
		expect(entries[0]).toMatchObject({ cardId: 'iron_sword', name: 'Rust-Forged Saber', icon: '⚔' });
		expect(entries[1]).toMatchObject({ cardId: 'battle_familiar', icon: '✦' });
		expect(entries[2]).toMatchObject({ cardId: 'dungeon_drake', icon: '🐉' });
	});

	it('marks evolved cards', () => {
		const entries = buildDeckMiniEntries(['steel_claymore']);
		expect(entries[0].isEvolved).toBe(true);
	});

	it('marks desperation cards and uses accent icons', () => {
		const entries = buildDeckMiniEntries(['rusty_shiv', 'throw_rock']);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			cardId: 'rusty_shiv',
			name: 'Emergency Shiv',
			icon: '🗡',
			isDesperation: true,
		});
		expect(entries[1]).toMatchObject({
			cardId: 'throw_rock',
			icon: '🪨',
			isDesperation: true,
		});
	});

	it('resolves inventory instance-id deck entries via the inventory', () => {
		const inventory = [
			{ instanceId: 'inst-1', cardId: 'iron_sword' },
			{ instanceId: 'inst-2', cardId: 'battle_familiar' },
		];
		const entries = buildDeckMiniEntries(['inst-1', 'inst-2'], inventory);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({ cardId: 'iron_sword', name: 'Rust-Forged Saber', icon: '⚔' });
		expect(entries[1]).toMatchObject({ cardId: 'battle_familiar', icon: '✦' });
	});

	it('handles mixed plain-id and instance-id decks, skipping unresolvable entries', () => {
		const inventory = [{ instanceId: 'inst-1', cardId: 'iron_sword' }];
		const entries = buildDeckMiniEntries(
			['inst-1', 'battle_familiar', 'inst-unknown', 'not_a_card'],
			inventory,
		);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({ cardId: 'iron_sword' });
		expect(entries[1]).toMatchObject({ cardId: 'battle_familiar' });
	});

	it('skips instance-id entries when no inventory is provided', () => {
		expect(buildDeckMiniEntries(['inst-1'])).toHaveLength(0);
	});
});

describe('resolveDeckCardId() with inventory', () => {
	it('resolves an instance id to its underlying card id', () => {
		const inventory = [{ instanceId: 'inst-1', cardId: 'iron_sword' }];
		expect(resolveDeckCardId('inst-1', inventory)).toBe('iron_sword');
	});

	it('returns null for an instance id whose cardId is unknown', () => {
		const inventory = [{ instanceId: 'inst-1', cardId: 'not_a_card' }];
		expect(resolveDeckCardId('inst-1', inventory)).toBeNull();
	});

	it('still resolves plain card ids when inventory is provided', () => {
		const inventory = [{ instanceId: 'inst-1', cardId: 'iron_sword' }];
		expect(resolveDeckCardId('steel_claymore', inventory)).toBe('steel_claymore');
	});
});

describe('getDeckStackLayerCount()', () => {
	it('returns 0 for an empty draw pile', () => {
		expect(getDeckStackLayerCount(0)).toBe(0);
	});

	it('scales layer count with remaining cards', () => {
		expect(getDeckStackLayerCount(1)).toBe(1);
		expect(getDeckStackLayerCount(6)).toBe(3);
		expect(getDeckStackLayerCount(12)).toBe(5);
	});
});

describe('formatDeckCountLabel()', () => {
	it('formats draw pile count against run total', () => {
		expect(formatDeckCountLabel(4, 8)).toBe('Deck: 4/8');
	});
});

describe('formatDesperationDeckCountLabel()', () => {
	it('formats remaining desperation cards', () => {
		expect(formatDesperationDeckCountLabel(1)).toBe('Desperation deck — 1 card left');
		expect(formatDesperationDeckCountLabel(3)).toBe('Desperation deck — 3 cards left');
	});
});

describe('computeRunDeckTotal()', () => {
	it('sums draw pile and cards currently in hand', () => {
		const total = computeRunDeckTotal(3, [{ id: 'a' }, null, { id: 'b' }]);
		expect(total).toBe(5);
	});

	it('falls back when both pile and hand are empty', () => {
		expect(computeRunDeckTotal(0, [])).toBe(8);
	});
});

describe('deckIdsForDisplay()', () => {
	it('shows the next card to draw first', () => {
		expect(deckIdsForDisplay(['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
	});
});

describe('setDrawPile()', () => {
	beforeEach(() => {
		resetHandState();
	});

	it('replaces the local draw pile', () => {
		setDrawPile(['iron_sword', 'flame_blade']);
		expect(deck).toEqual(['iron_sword', 'flame_blade']);
	});
});

describe('renderDeckViewer() / renderDeckStack()', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		resetHandState();

		const requiredIds = [
			'status', 'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
			'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
			'currency-display', 'objective-hud', 'ui', 'card-hand',
			'lobby', 'lobby-player-list',
			'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
			'summary-currency', 'summary-rewards', 'summary-rewards-currency',
			'summary-rewards-cards', 'return-to-lobby-btn',
			'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
			'deck-stack', 'deck-viewer-overlay', 'deck-viewer-grid', 'deck-viewer-count',
		];
		for (const id of requiredIds) {
			const el = (id === 'return-to-lobby-btn')
				? document.createElement('button')
				: document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}

		const cardHand = document.getElementById('card-hand');
		for (let i = 0; i < 6; i++) {
			const slot = document.createElement('div');
			slot.className = 'card-slot';
			slot.dataset.slotIndex = String(i);
			cardHand.appendChild(slot);
		}

		const overlay = document.getElementById('deck-viewer-overlay');
		overlay.classList.add('hidden');
	});

	it('renders draw pile cards with type icons and toggles via V key', async () => {
		await import('../main.js');

		setDrawPile(['iron_sword', 'battle_familiar', 'dungeon_drake']);
		window.__setRunDeckTotal(8);
		window.renderDeckViewer();
		window.renderDeckStack();

		const minis = document.querySelectorAll('.deck-card-mini');
		expect(minis.length).toBe(3);
		expect(document.getElementById('deck-viewer-count').textContent).toBe('Deck: 3/8');
		expect(document.getElementById('deck-stack').title).toBe('Deck: 3/8');
		expect(document.getElementById('deck-stack').querySelectorAll('.deck-stack-card').length).toBe(2);

		window.toggleDeckViewer(true);
		expect(window.__isDeckViewerOpen()).toBe(true);
		expect(document.getElementById('deck-viewer-overlay').classList.contains('hidden')).toBe(false);

		window.toggleDeckViewer(false);
		expect(window.__isDeckViewerOpen()).toBe(false);
	});
});
