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
		expect(toolbar.querySelector('#logout-btn')).not.toBeNull();
		expect(toolbar.querySelector('#settings-btn')).not.toBeNull();
		expect(toolbar.querySelector('#mute-btn')).not.toBeNull();
		expect(ui.querySelector('#settings-btn')).toBeNull();
		expect(ui.querySelector('#logout-btn')).toBeNull();
		expect(ui.querySelector('#mute-btn')).toBeNull();
	});

	it('adds a Settings button to the lobby browser actions row', () => {
		const doc = parseIndex();
		const actions = doc.getElementById('lobby-browser-actions');
		const settingsBtn = doc.getElementById('lobby-browser-settings-btn');

		expect(actions).not.toBeNull();
		expect(settingsBtn).not.toBeNull();
		expect(settingsBtn.classList.contains('lobby-settings-btn')).toBe(true);
		expect(actions.contains(settingsBtn)).toBe(true);
	});

	it('adds a Settings button to the lobby header beside the guild title', () => {
		const doc = parseIndex();
		const lobby = doc.getElementById('lobby');
		const header = lobby?.querySelector('.lobby-header');
		const settingsBtn = doc.getElementById('lobby-settings-btn');

		expect(header).not.toBeNull();
		expect(header.querySelector('h2')?.textContent).toBe('Hunter Guild');
		expect(settingsBtn).not.toBeNull();
		expect(settingsBtn.classList.contains('lobby-settings-btn')).toBe(true);
		expect(header.contains(settingsBtn)).toBe(true);
	});

	it('keeps the shared settings overlay available for all entry points', () => {
		const doc = parseIndex();
		const overlay = doc.getElementById('settings-overlay');

		expect(overlay).not.toBeNull();
		expect(overlay.querySelector('#settings-modal')).not.toBeNull();
		expect(overlay.querySelector('#lock-on-repeat-select')).not.toBeNull();
	});
});
