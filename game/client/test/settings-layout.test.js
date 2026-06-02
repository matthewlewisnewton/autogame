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

	it('includes useKeyItem binding remap row in the Controls section', () => {
		const doc = parseIndex();
		const controlsSection = doc.querySelector('#settings-modal .settings-section h3');
		expect(controlsSection?.textContent).toBe('Controls');
		expect(doc.getElementById('use-key-item-key-input')).not.toBeNull();
		expect(doc.getElementById('use-key-item-gamepad-label')).not.toBeNull();
		const keyInput = doc.getElementById('use-key-item-key-input');
		expect(keyInput.readOnly).toBe(true);
	});

	it('includes account appearance cosmetic controls and character portrait target', () => {
		const doc = parseIndex();
		const accountOverlay = doc.getElementById('account-overlay');
		const appearanceHeading = Array.from(
			accountOverlay?.querySelectorAll('.settings-section h3') ?? []
		).find((h) => h.textContent === 'Appearance');

		expect(appearanceHeading).not.toBeNull();

		const cosmeticIds = [
			'cosmetic-body-colors',
			'cosmetic-accent-color',
			'cosmetic-body-shapes',
			'cosmetic-preview',
			'cosmetic-save-btn',
			'cosmetic-error',
		];
		for (const id of cosmeticIds) {
			expect(doc.getElementById(id), `missing #${id}`).not.toBeNull();
		}

		const swatches = doc.querySelectorAll('#cosmetic-body-colors .cosmetic-swatch');
		expect(swatches.length).toBeGreaterThanOrEqual(6);
		for (const swatch of swatches) {
			expect(swatch.getAttribute('data-color')).toMatch(/^#[0-9a-f]{6}$/i);
			expect(swatch.hasAttribute('aria-pressed')).toBe(true);
		}

		const shapes = doc.querySelectorAll('#cosmetic-body-shapes .cosmetic-shape-btn');
		expect(shapes).toHaveLength(4);
		for (const shape of ['box', 'cylinder', 'cone', 'capsule']) {
			expect(doc.querySelector(`#cosmetic-body-shapes [data-shape="${shape}"]`)).not.toBeNull();
		}
		for (const btn of shapes) {
			expect(btn.hasAttribute('aria-pressed')).toBe(true);
		}

		expect(doc.getElementById('cosmetic-error')?.hasAttribute('hidden')).toBe(true);

		const frame = doc.getElementById('character-frame');
		const portrait = doc.getElementById('character-portrait');
		const characterId = doc.getElementById('character-id');
		expect(frame).not.toBeNull();
		expect(portrait).not.toBeNull();
		expect(characterId).not.toBeNull();
		expect(frame?.contains(portrait)).toBe(true);
		expect(frame?.contains(characterId)).toBe(true);
		const frameChildren = Array.from(frame?.children ?? []);
		expect(frameChildren.indexOf(portrait)).toBeLessThan(frameChildren.indexOf(characterId));
	});
});
