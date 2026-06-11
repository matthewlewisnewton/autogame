import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAttackCastHint } from '../input.js';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';
import { patchSettings, getDefaultSettings, getSettings } from '../settings.js';

describe('getAttackCastHint', () => {
	beforeEach(() => {
		installGamepadMock();
		clearMockGamepads();
		patchSettings(getDefaultSettings());
		const settings = getSettings();
		settings.gamepad.bindings = {};
		settings.gamepad.profile = 'auto';
	});

	afterEach(() => {
		uninstallGamepadMock();
	});

	it('keyboard/mouse mode keeps the original "Click to attack · 1–6" copy', () => {
		patchSettings({ gamepad: { profile: 'auto' } });
		const hint = getAttackCastHint();
		expect(hint.mode).toBe('keyboard');
		expect(hint.text).toBe('Click to attack · press 1–6 to cast cards');
	});

	it('standard gamepad mode uses resolved face-button labels, not Click/1–6', () => {
		patchSettings({ gamepad: { profile: 'standard' } });
		const hint = getAttackCastHint();
		expect(hint.mode).toBe('gamepad');
		// Attack verb = slot 0 (A); cast range = first–last slot labels (A–RB).
		expect(hint.text).toBe('Press A to attack · press A–RB to cast cards');
		expect(hint.text).toContain('A');
		expect(hint.text).toContain('RB');
		expect(hint.text).not.toContain('Click');
		expect(hint.text).not.toContain('1–6');
	});

	it('8BitDo 64 gamepad mode uses C-button labels, not Click/1–6', () => {
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		const hint = getAttackCastHint();
		expect(hint.mode).toBe('gamepad');
		// Cast range spans A (slot 0) through C right (slot 5).
		expect(hint.text).toBe('Press A to attack · press A–C right to cast cards');
		expect(hint.text).toContain('C right');
		expect(hint.text).not.toContain('Click');
		expect(hint.text).not.toContain('1–6');
		// Plain-text label, never the inline SVG mark used by the slot badges.
		expect(hint.text).not.toContain('c-button-mark');
	});

	it('8BitDo 64 reflects remapped slot-0 attack and cast-range labels', () => {
		patchSettings({
			gamepad: {
				profile: '8bitdo-64',
				bindings: {
					// Remap the attack slot (default A) to face B.
					useSlot0: { type: 'button', index: 1 },
					// Remap the last cast slot (default C right) to C up.
					useSlot5: { type: 'cButton', direction: 'up' },
				},
			},
		});
		const hint = getAttackCastHint();
		expect(hint.mode).toBe('gamepad');
		// Attack verb follows the remapped slot 0 (B); cast range first–last
		// now spans the remapped B (slot 0) through C up (slot 5).
		expect(hint.text).toBe('Press B to attack · press B–C up to cast cards');
		expect(hint.text).not.toContain('Press A to attack');
		expect(hint.text).not.toContain('C right');
		expect(hint.text).not.toContain('c-button-mark');
	});

	it('auto profile switches to gamepad copy once a controller is connected', () => {
		patchSettings({ gamepad: { profile: 'auto' } });
		expect(getAttackCastHint().mode).toBe('keyboard');
		mockGamepad(0, { id: 'Xbox 360 Controller (XInput)', buttons: [], axes: [0, 0, 0, 0] });
		const hint = getAttackCastHint();
		expect(hint.mode).toBe('gamepad');
		expect(hint.text).not.toContain('Click');
	});

	it('no key item fragment when equippedKeyItemId is falsy', () => {
		const hint = getAttackCastHint(null);
		expect(hint.text).toBe('Click to attack · press 1–6 to cast cards');
		expect(hint.text).not.toContain('key item');
	});

	it('appends key item binding (default E) when equippedKeyItemId is truthy', () => {
		const hint = getAttackCastHint('some_key_item');
		expect(hint.mode).toBe('keyboard');
		expect(hint.text).toBe('Click to attack · press 1–6 to cast cards · E for key item');
	});

	it('appends rebound keyboard binding when useKeyItem is remapped', () => {
		patchSettings({ keyboard: { bindings: { useKeyItem: 'q' } } });
		const hint = getAttackCastHint('some_key_item');
		expect(hint.text).toBe('Click to attack · press 1–6 to cast cards · Q for key item');
	});

	it('appends gamepad binding label when equipped and in gamepad mode', () => {
		patchSettings({ gamepad: { profile: 'standard' } });
		mockGamepad(0, { id: 'Xbox 360 Controller (XInput)', buttons: [], axes: [0, 0, 0, 0] });
		const hint = getAttackCastHint('some_key_item');
		expect(hint.mode).toBe('gamepad');
		expect(hint.text).toContain('Press A to attack · press A–RB to cast cards');
		expect(hint.text).toContain('DPad Down for key item');
	});

	it('appends 8BitDo 64 gamepad binding label when equipped', () => {
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		const hint = getAttackCastHint('some_key_item');
		expect(hint.mode).toBe('gamepad');
		expect(hint.text).toContain('for key item');
		// 8BitDo 64 default useKeyItem is button 13 (DPad Down) — label should not be the raw index
		expect(hint.text).not.toContain('Btn 13');
	});
});
