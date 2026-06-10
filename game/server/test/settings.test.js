import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	getDefaultSettings,
	getSettings,
	updateSettings,
	initSettingsPath,
	clearAllSettings,
	resetSettingsPath,
	validateSettings,
	backfillSettings,
} from '../settings.js';

describe('settings persistence', () => {
	let tmpDir;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
		resetSettingsPath();
		initSettingsPath(tmpDir);
		clearAllSettings();
	});

	afterEach(() => {
		resetSettingsPath();
		try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
	});

	it('getDefaultSettings has expected defaults', () => {
		const defaults = getDefaultSettings();
		expect(defaults.soundEnabled).toBe(true);
		expect(defaults.particlesEnabled).toBe(true);
		expect(defaults.showHitboxes).toBe(true);
		expect(defaults.gamepad.moveStick).toBe('left');
		expect(defaults.gamepad.deadzone).toBe(0.15);
		expect(defaults.lockOnRepeatAction).toBe('unlock');
		expect(defaults.keyboard.bindings.useKeyItem).toBe('e');
	});

	it('getSettings returns defaults when file missing', () => {
		const s = getSettings('acct-new');
		expect(s).toEqual(getDefaultSettings());
	});

	it('updateSettings persists and deep-merges', () => {
		const id = 'acct-1';
		updateSettings(id, { soundEnabled: false });
		const loaded = getSettings(id);
		expect(loaded.soundEnabled).toBe(false);
		expect(loaded.particlesEnabled).toBe(true);

		updateSettings(id, { gamepad: { deadzone: 0.2 } });
		const merged = getSettings(id);
		expect(merged.soundEnabled).toBe(false);
		expect(merged.gamepad.deadzone).toBe(0.2);
		expect(merged.gamepad.moveStick).toBe('left');
	});

	it('updateSettings deep-merges keyboard.bindings.useKeyItem', () => {
		const id = 'acct-kb';
		updateSettings(id, { keyboard: { bindings: { useKeyItem: 'u' } } });
		const s = getSettings(id);
		expect(s.keyboard.bindings.useKeyItem).toBe('u');
		expect(s.soundEnabled).toBe(true);
	});

	it('updateSettings deep-merges gamepad.bindings.useKeyItem', () => {
		const id = 'acct-gp';
		updateSettings(id, { gamepad: { bindings: { useKeyItem: { type: 'button', index: 4 } } } });
		const s = getSettings(id);
		expect(s.gamepad.bindings.useKeyItem).toEqual({ type: 'button', index: 4 });
		expect(s.gamepad.moveStick).toBe('left');
	});
});

describe('validateSettings', () => {
	it('accepts valid partial updates for every whitelisted field', () => {
		const result = validateSettings({
			soundEnabled: false,
			particlesEnabled: true,
			showHitboxes: false,
			lockOnRepeatAction: 'cycle',
			keyboard: { bindings: { useKeyItem: 'q' } },
			gamepad: {
				bindings: {
					useKeyItem: { type: 'button', index: 4 },
					useSlot2: { type: 'cButton', direction: 'up', threshold: 0.2 },
				},
				moveStick: 'right',
				deadzone: 0.25,
				profile: '8bitdo-64',
				modifierButton: 6,
			},
		});
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({
			soundEnabled: false,
			particlesEnabled: true,
			showHitboxes: false,
			lockOnRepeatAction: 'cycle',
			keyboard: { bindings: { useKeyItem: 'q' } },
			gamepad: {
				bindings: {
					useKeyItem: { type: 'button', index: 4 },
					useSlot2: { type: 'cButton', direction: 'up', threshold: 0.2 },
				},
				moveStick: 'right',
				deadzone: 0.25,
				profile: '8bitdo-64',
				modifierButton: 6,
			},
		});
	});

	it('accepts axis gamepad bindings', () => {
		const result = validateSettings({
			gamepad: {
				bindings: {
					useSlot0: { type: 'axis', axis: 'cX', direction: 'negative', threshold: 0.35 },
				},
			},
		});
		expect(result.ok).toBe(true);
		expect(result.value.gamepad.bindings.useSlot0).toEqual({
			type: 'axis',
			axis: 'cX',
			direction: 'negative',
			threshold: 0.35,
		});
	});

	it('ignores unknown top-level keys', () => {
		const result = validateSettings({ soundEnabled: false, hackerField: 'nope' });
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ soundEnabled: false });
		expect(result.value.hackerField).toBeUndefined();
	});

	it('rejects non-object bodies', () => {
		expect(validateSettings(null).ok).toBe(false);
		expect(validateSettings('bad').ok).toBe(false);
		expect(validateSettings([]).ok).toBe(false);
	});

	it('rejects invalid boolean types', () => {
		expect(validateSettings({ soundEnabled: 'yes' }).ok).toBe(false);
		expect(validateSettings({ particlesEnabled: 1 }).ok).toBe(false);
		expect(validateSettings({ showHitboxes: null }).ok).toBe(false);
	});

	it('rejects invalid lockOnRepeatAction', () => {
		const result = validateSettings({ lockOnRepeatAction: 'teleport' });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/lockOnRepeatAction/);
	});

	it('rejects unknown keyboard binding actions', () => {
		const result = validateSettings({ keyboard: { bindings: { dodge: 'x' } } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/Unknown keyboard binding action/);
	});

	it('rejects invalid keyboard binding keys', () => {
		expect(validateSettings({ keyboard: { bindings: { useKeyItem: 'E' } } }).ok).toBe(false);
		expect(validateSettings({ keyboard: { bindings: { useKeyItem: 'shift' } } }).ok).toBe(false);
		expect(validateSettings({ keyboard: { bindings: { useKeyItem: 1 } } }).ok).toBe(false);
	});

	it('rejects unknown gamepad binding actions', () => {
		const result = validateSettings({ gamepad: { bindings: { lockOn: { type: 'button', index: 0 } } } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/Unknown gamepad binding action/);
	});

	it('rejects invalid gamepad binding shapes', () => {
		expect(validateSettings({ gamepad: { bindings: { useKeyItem: { type: 'button' } } } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { bindings: { useKeyItem: { type: 'axis', axis: 0 } } } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { bindings: { useSlot2: { type: 'cButton', direction: 'diagonal' } } } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { bindings: { useKeyItem: 'button-4' } } }).ok).toBe(false);
	});

	it('rejects out-of-range deadzone', () => {
		expect(validateSettings({ gamepad: { deadzone: -0.1 } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { deadzone: 1.5 } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { deadzone: 'low' } }).ok).toBe(false);
	});

	it('rejects invalid gamepad profile and moveStick', () => {
		expect(validateSettings({ gamepad: { profile: 'xbox' } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { moveStick: 'middle' } }).ok).toBe(false);
	});

	it('rejects invalid modifierButton', () => {
		expect(validateSettings({ gamepad: { modifierButton: -1 } }).ok).toBe(false);
		expect(validateSettings({ gamepad: { modifierButton: 1.5 } }).ok).toBe(false);
	});
});

describe('backfillSettings', () => {
	it('returns defaults for undefined input', () => {
		expect(backfillSettings(undefined)).toEqual(getDefaultSettings());
	});

	it('preserves valid stored fields', () => {
		const result = backfillSettings({
			soundEnabled: false,
			lockOnRepeatAction: 'reacquire',
			keyboard: { bindings: { useKeyItem: 'u' } },
			gamepad: {
				deadzone: 0.2,
				profile: 'standard',
				bindings: { useKeyItem: { type: 'button', index: 11 } },
				modifierButton: 7,
			},
		});
		expect(result.soundEnabled).toBe(false);
		expect(result.lockOnRepeatAction).toBe('reacquire');
		expect(result.keyboard.bindings.useKeyItem).toBe('u');
		expect(result.gamepad.deadzone).toBe(0.2);
		expect(result.gamepad.profile).toBe('standard');
		expect(result.gamepad.bindings.useKeyItem).toEqual({ type: 'button', index: 11 });
		expect(result.gamepad.modifierButton).toBe(7);
	});

	it('prunes junk top-level and nested keys', () => {
		const result = backfillSettings({
			extraTop: true,
			soundEnabled: false,
			keyboard: { bindings: { useKeyItem: 'q', bogus: 'x' }, extra: 1 },
			gamepad: {
				bindings: {
					useKeyItem: { type: 'button', index: 4 },
					invalidAction: { type: 'button', index: 0 },
					useSlot1: { type: 'nope' },
				},
				deadzone: 99,
				profile: 'unknown',
				hack: true,
			},
		});
		expect(result.extraTop).toBeUndefined();
		expect(result.soundEnabled).toBe(false);
		expect(result.keyboard.bindings).toEqual({ useKeyItem: 'q' });
		expect(result.keyboard.extra).toBeUndefined();
		expect(result.gamepad.bindings).toEqual({ useKeyItem: { type: 'button', index: 4 } });
		expect(result.gamepad.deadzone).toBe(getDefaultSettings().gamepad.deadzone);
		expect(result.gamepad.profile).toBe(getDefaultSettings().gamepad.profile);
		expect(result.gamepad.hack).toBeUndefined();
	});

	it('clamps deadzone to the valid range', () => {
		expect(backfillSettings({ gamepad: { deadzone: 0.99 } }).gamepad.deadzone).toBe(0.95);
		expect(backfillSettings({ gamepad: { deadzone: -1 } }).gamepad.deadzone).toBe(getDefaultSettings().gamepad.deadzone);
	});

	it('drops invalid types and uses defaults', () => {
		const result = backfillSettings({
			soundEnabled: 'yes',
			lockOnRepeatAction: 'invalid',
			keyboard: { bindings: { useKeyItem: 'CAPS' } },
		});
		expect(result.soundEnabled).toBe(getDefaultSettings().soundEnabled);
		expect(result.lockOnRepeatAction).toBe(getDefaultSettings().lockOnRepeatAction);
		expect(result.keyboard.bindings.useKeyItem).toBe(getDefaultSettings().keyboard.bindings.useKeyItem);
	});
});
