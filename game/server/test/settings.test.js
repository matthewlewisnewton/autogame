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
	resetSettingsPath
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
