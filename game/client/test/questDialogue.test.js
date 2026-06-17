import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import eventsCatalog from '../../shared/events.json';

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

const MAIN_DOM_IDS = [
	'status', 'vanguard-hud', 'character-id', 'player-level',
	'hp-bar-container', 'hp-label', 'hp-bar-bg', 'hp-bar-fill', 'hp-text',
	'ms-bar-container', 'ms-label', 'ms-bar-bg', 'ms-bar-fill', 'ms-text',
	'deck-count', 'deck-weapon-count', 'deck-spell-count', 'deck-creature-count', 'deck-enchantment-count',
	'currency-display', 'objective-hud', 'top-right-hud-stack', 'quest-comms-log', 'ui', 'card-hand',
	'lobby', 'lobby-browser', 'lobby-player-list',
	'run-summary-overlay', 'summary-status', 'summary-duration', 'summary-enemies',
	'summary-currency', 'summary-rewards', 'summary-rewards-currency',
	'summary-rewards-cards', 'summary-card-choices', 'summary-card-choices-heading',
	'summary-card-choices-list', 'summary-card-choices-empty', 'return-to-lobby-btn',
	'owned-cards-list', 'selected-deck-list', 'deck-size-display', 'deck-error',
];

function ensureElement(id, tag = 'div') {
	if (document.getElementById(id)) return;
	const el = document.createElement(tag);
	el.id = id;
	document.body.appendChild(el);
}

function ensureMainDom() {
	for (const id of MAIN_DOM_IDS) {
		const tag = id === 'return-to-lobby-btn' ? 'button' : 'div';
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
	const stack = document.getElementById('top-right-hud-stack');
	const log = document.getElementById('quest-comms-log');
	if (stack && log && log.parentElement !== stack) {
		stack.appendChild(log);
	}
	if (log) {
		log.className = 'quest-comms-log hidden';
		log.setAttribute('aria-hidden', 'true');
	}
}

function playingGameState() {
	return {
		gamePhase: 'playing',
		players: { p1: { id: 'p1', hp: 100, hand: [] } },
		run: { questId: 'training_caverns', questTier: 1, objective: { type: 'defeat_enemies' } },
	};
}

describe('quest dialogue comms UI (main.js)', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		document.body.innerHTML = '';
		if (typeof window.__resetSocketHandlersForTest === 'function') {
			window.__resetSocketHandlersForTest();
		}
		ensureMainDom();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('shows a comms toast and appends to the log via the test hook', async () => {
		await import('../main.js');
		window.__setGameState(playingGameState(), 'p1');
		window.__syncQuestCommsPhaseForTest('playing');

		window.__showQuestDialogueForTest({
			speaker: 'Rewa',
			text: 'Radio check — sweep the annex and report when the sector is clear.',
		});

		const toast = document.querySelector('.quest-comms-toast');
		expect(toast).not.toBeNull();
		expect(toast.textContent).toContain('Rewa:');
		expect(toast.textContent).toContain('Radio check');
		expect(toast.parentElement?.id).toBe('top-right-hud-stack');
		expect(toast.nextElementSibling?.id).toBe('quest-comms-log');

		const log = document.getElementById('quest-comms-log');
		const line = log.querySelector('.quest-comms-line');
		expect(line).not.toBeNull();
		expect(line.querySelector('.quest-comms-line-speaker').textContent).toBe('Rewa:');
		expect(line.querySelector('.quest-comms-line-text').textContent).toContain('Radio check');
		expect(line.querySelector('.quest-comms-line-seq').textContent).toBe('01');
	});

	it('auto-dismisses the comms toast after ~4s', async () => {
		await import('../main.js');
		window.__setGameState(playingGameState(), 'p1');
		window.__syncQuestCommsPhaseForTest('playing');

		window.__showQuestDialogueForTest({ speaker: 'Rewa', text: 'Ping.' });
		expect(document.querySelector('.quest-comms-toast')).not.toBeNull();

		vi.advanceTimersByTime(4000);
		expect(document.querySelector('.quest-comms-toast').style.opacity).toBe('0');

		vi.advanceTimersByTime(300);
		expect(document.querySelector('.quest-comms-toast')).toBeNull();
	});

	it('ignores malformed questDialogue payloads', async () => {
		await import('../main.js');
		window.__setGameState(playingGameState(), 'p1');
		window.__syncQuestCommsPhaseForTest('playing');

		window.__showQuestDialogueForTest({ speaker: '', text: 'Nope' });
		window.__showQuestDialogueForTest({ speaker: 'Rewa' });
		window.__showQuestDialogueForTest(null);

		expect(document.querySelector('.quest-comms-toast')).toBeNull();
		expect(window.__getQuestCommsLogLineCountForTest()).toBe(0);
	});

	it('keeps only the last 20 log entries', async () => {
		await import('../main.js');
		window.__setGameState(playingGameState(), 'p1');
		window.__syncQuestCommsPhaseForTest('playing');

		for (let i = 1; i <= 21; i += 1) {
			window.__showQuestDialogueForTest({ speaker: 'Rewa', text: `Line ${i}` });
		}

		const log = document.getElementById('quest-comms-log');
		expect(log.children.length).toBe(20);
		expect(log.querySelector('.quest-comms-line-text').textContent).toContain('Line 2');
		expect(log.lastElementChild.querySelector('.quest-comms-line-text').textContent).toContain('Line 21');
	});

	it('hides and clears comms when returning to lobby', async () => {
		await import('../main.js');
		window.__setGameState(playingGameState(), 'p1');
		window.__syncQuestCommsPhaseForTest('playing');
		window.__showQuestDialogueForTest({ speaker: 'Rewa', text: 'In run.' });

		window.__syncQuestCommsPhaseForTest('lobby');

		const log = document.getElementById('quest-comms-log');
		expect(log.classList.contains('hidden')).toBe(true);
		expect(log.children.length).toBe(0);
	});

	it('handles questDialogue socket events when playing', async () => {
		await import('../main.js');
		window.__setGameState(playingGameState(), 'p1');
		window.__syncQuestCommsPhaseForTest('playing');

		window.__triggerSocketEvent(SERVER_TO_CLIENT.QUEST_DIALOGUE, {
			speaker: 'Rewa',
			text: 'Socket line.',
			questId: 'training_caverns',
			tier: 1,
			trigger: 'run_start',
		});

		expect(document.querySelector('.quest-comms-toast').textContent).toContain('Socket line.');
		expect(window.__getQuestCommsLogLineCountForTest()).toBe(1);
	});

	it('does not render comms outside the playing phase', async () => {
		await import('../main.js');
		window.__setGameState({ gamePhase: 'lobby', players: { p1: { id: 'p1' } } }, 'p1');

		window.__showQuestDialogueForTest({ speaker: 'Rewa', text: 'Lobby should ignore.' });

		expect(document.querySelector('.quest-comms-toast')).toBeNull();
		expect(window.__getQuestCommsLogLineCountForTest()).toBe(0);
	});

	it('queues pre-playing questDialogue and flushes when gamePhase becomes playing', async () => {
		await import('../main.js');
		window.__setGameState({ gamePhase: 'lobby', players: { p1: { id: 'p1' } } }, 'p1');
		window.__syncQuestCommsPhaseForTest('lobby');

		window.__triggerSocketEvent(SERVER_TO_CLIENT.QUEST_DIALOGUE, {
			speaker: 'Rewa',
			text: 'Queued run-start line.',
			questId: 'training_caverns',
			tier: 1,
			trigger: 'run_start',
		});

		expect(document.querySelector('.quest-comms-toast')).toBeNull();
		expect(window.__getQuestCommsLogLineCountForTest()).toBe(0);

		window.__triggerSocketEvent(SERVER_TO_CLIENT.STATE_UPDATE, playingGameState());

		expect(document.querySelector('.quest-comms-toast').textContent).toContain('Queued run-start line.');
		expect(window.__getQuestCommsLogLineCountForTest()).toBe(1);
	});
});
