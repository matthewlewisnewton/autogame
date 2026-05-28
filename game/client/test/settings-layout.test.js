import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function parseIndex() {
	return new JSDOM(indexHtml).window.document;
}

describe('settings layout in index.html', () => {
	it('places account controls in #app-toolbar outside the in-game #ui HUD', () => {
		const doc = parseIndex();
		const toolbar = doc.getElementById('app-toolbar');
		const ui = doc.getElementById('ui');

		expect(toolbar).not.toBeNull();
		expect(ui).not.toBeNull();
		expect(toolbar.querySelector('#account-btn')).not.toBeNull();
		expect(toolbar.querySelector('#level-settings-btn')).not.toBeNull();
		expect(toolbar.querySelector('#settings-btn')).not.toBeNull();
		expect(toolbar.querySelector('#mute-btn')).not.toBeNull();
		expect(toolbar.querySelector('#logout-btn')).toBeNull();
		expect(ui.querySelector('#account-btn')).toBeNull();
		expect(ui.querySelector('#settings-btn')).toBeNull();
		expect(ui.querySelector('#mute-btn')).toBeNull();
	});

	it('includes level settings overlay with give up control', () => {
		const doc = parseIndex();
		const overlay = doc.getElementById('level-settings-overlay');
		const btn = doc.getElementById('level-settings-btn');

		expect(overlay).not.toBeNull();
		expect(overlay.querySelector('#give-up-btn')).not.toBeNull();
		expect(overlay.querySelector('#level-loot-earned')).not.toBeNull();
		expect(overlay.querySelector('#level-return-currency')).not.toBeNull();
		expect(overlay.querySelector('#level-return-cards')).not.toBeNull();
		expect(overlay.querySelector('#level-give-up-cost')).not.toBeNull();
		expect(overlay.querySelector('#level-settings-error')).not.toBeNull();
		expect(doc.getElementById('lobby-tab-medic')).not.toBeNull();
		expect(doc.getElementById('guild-medic')).not.toBeNull();
		expect(doc.getElementById('medic-heal-btn')).not.toBeNull();
		expect(btn?.classList.contains('hidden')).toBe(true);
	});

	it('keeps logout on the account page instead of the toolbar', () => {
		const doc = parseIndex();
		const toolbar = doc.getElementById('app-toolbar');
		const accountOverlay = doc.getElementById('account-overlay');

		expect(toolbar?.querySelector('#logout-btn')).toBeNull();
		expect(accountOverlay).not.toBeNull();
		expect(accountOverlay?.querySelector('#account-username-input')).not.toBeNull();
		expect(accountOverlay?.querySelector('#account-save-btn')).not.toBeNull();
		expect(accountOverlay?.querySelector('#account-logout-btn')).not.toBeNull();
	});

	it('keeps settings in the app toolbar only (no duplicate lobby buttons)', () => {
		const doc = parseIndex();
		const toolbar = doc.getElementById('app-toolbar');
		const lobbyBrowserActions = doc.getElementById('lobby-browser-actions');
		const lobbyHeader = doc.getElementById('lobby')?.querySelector('.lobby-header');

		expect(doc.querySelectorAll('#settings-btn')).toHaveLength(1);
		expect(toolbar?.querySelector('#settings-btn')).not.toBeNull();
		expect(lobbyBrowserActions?.querySelector('#lobby-browser-settings-btn')).toBeNull();
		expect(lobbyHeader?.querySelector('#lobby-settings-btn')).toBeNull();
	});

	it('keeps the shared settings overlay available for all entry points', () => {
		const doc = parseIndex();
		const overlay = doc.getElementById('settings-overlay');

		expect(overlay).not.toBeNull();
		expect(overlay.querySelector('#settings-modal')).not.toBeNull();
		expect(overlay.querySelector('#lock-on-repeat-select')).not.toBeNull();
	});

	it('includes controller calibration controls in the settings overlay', () => {
		const doc = parseIndex();
		const section = doc.getElementById('controller-calibration-section');

		expect(section).not.toBeNull();
		expect(doc.getElementById('gamepad-status')).not.toBeNull();
		expect(doc.getElementById('gamepad-profile-select')).not.toBeNull();
		expect(doc.getElementById('gamepad-deadzone-slider')).not.toBeNull();
		expect(doc.getElementById('gamepad-move-stick-select')).not.toBeNull();
		expect(doc.getElementById('calibration-button-grid')).not.toBeNull();
		expect(doc.getElementById('calibration-debug-log')).not.toBeNull();
		expect(doc.getElementById('calibration-debug-copy-btn')).not.toBeNull();
	});
});
