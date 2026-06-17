import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	is8BitDoGamepad,
	is8BitDo64Gamepad,
	getCalibrationGamepad,
	describeGamepadConnection,
	describeGamepadMapping,
	hasStandardGamepadMapping,
	parseGamepadId,
	formatGamepadDeviceInfo,
	isSafariBrowser,
	getGamepadActivationHint,
	EIGHTBITDO_VENDOR_ID,
	EIGHTBITDO_64_PRODUCT_ID,
	EIGHTBITDO_64_BT_PRODUCT_ID,
	is8BitDo64BluetoothGamepad,
	get8BitDo64VerticalCAxisIndex,
} from '../gamepad-detect.js';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';

describe('parseGamepadId()', () => {
	it('parses Chrome-style vendor/product strings', () => {
		expect(parseGamepadId('8Bitdo SF30 Pro (Vendor: 2dc8 Product: 6000)')).toEqual({
			name: '8Bitdo SF30 Pro',
			vendorId: 0x2dc8,
			productId: 0x6000,
		});
	});

	it('parses Firefox-style vendor-product-name strings', () => {
		expect(parseGamepadId('2dc8-6000-8Bitdo SF30 Pro')).toEqual({
			name: '8Bitdo SF30 Pro',
			vendorId: 0x2dc8,
			productId: 0x6000,
		});
	});
});

describe('is8BitDoGamepad()', () => {
	it('matches 8BitDo name in gamepad id', () => {
		expect(is8BitDoGamepad({ id: '8BitDo Ultimate Controller (Vendor: 2dc8 Product: 3012)' })).toBe(true);
		expect(is8BitDoGamepad({ id: '8-Bit-Do Pro 2' })).toBe(true);
	});

	it('matches 8BitDo vendor id in Chrome and Firefox id formats', () => {
		expect(is8BitDoGamepad({ id: 'Generic Controller (Vendor: 2dc8 Product: 6001)' })).toBe(true);
		expect(is8BitDoGamepad({ id: '2dc8-6001-8BitDo Controller' })).toBe(true);
	});

	it('rejects non-8BitDo controllers', () => {
		expect(is8BitDoGamepad({ id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' })).toBe(false);
		expect(is8BitDoGamepad(null)).toBe(false);
	});

	it('uses the documented vendor id constant', () => {
		expect(EIGHTBITDO_VENDOR_ID).toBe(0x2dc8);
		expect(EIGHTBITDO_64_PRODUCT_ID).toBe(0x1930);
	});

	it('detects the 8BitDo 64 controller', () => {
		expect(is8BitDo64Gamepad({ id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)' })).toBe(true);
		expect(is8BitDo64Gamepad({ id: '2dc8-1930-8BitDo 64' })).toBe(true);
		expect(is8BitDo64Gamepad({ id: '8BitDo 64 Bluetooth Controller (Vendor: 2dc8 Product: 3019)' })).toBe(true);
		expect(EIGHTBITDO_64_BT_PRODUCT_ID).toBe(0x3019);
		expect(is8BitDo64BluetoothGamepad({ id: '8BitDo 64 Bluetooth Controller (Vendor: 2dc8 Product: 3019)' })).toBe(true);
		expect(get8BitDo64VerticalCAxisIndex({ id: '8BitDo 64 Bluetooth Controller (Vendor: 2dc8 Product: 3019)' })).toBe(5);
		expect(get8BitDo64VerticalCAxisIndex({ id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)' })).toBeNull();
	});
});

describe('describeGamepadMapping()', () => {
	it('describes standard and non-standard mapping', () => {
		expect(describeGamepadMapping({ mapping: 'standard' })).toBe('W3C standard mapping');
		expect(describeGamepadMapping({ id: '8BitDo Pro 2', mapping: '' })).toContain('non-standard');
		expect(hasStandardGamepadMapping({ mapping: 'standard' })).toBe(true);
		expect(hasStandardGamepadMapping({ mapping: '' })).toBe(false);
	});
});

describe('getCalibrationGamepad()', () => {
	beforeEach(() => {
		installGamepadMock();
		clearMockGamepads();
	});

	afterEach(() => {
		uninstallGamepadMock();
	});

	it('prefers an attached 8BitDo 64 pad over other 8BitDo controllers', () => {
		mockGamepad(0, { id: '8BitDo SN30 Pro (Vendor: 2dc8 Product: 6001)' });
		mockGamepad(1, { id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)' });
		const pad = getCalibrationGamepad();
		expect(pad?.index).toBe(1);
	});

	it('falls back to the first connected pad', () => {
		mockGamepad(0, { id: 'PlayStation Controller' });
		expect(getCalibrationGamepad()?.index).toBe(0);
	});
});

describe('describeGamepadConnection()', () => {
	it('describes 8BitDo and generic controllers', () => {
		expect(describeGamepadConnection(null)).toBe('No controller detected');
		expect(describeGamepadConnection({ id: '8BitDo Pro 2' })).toBe('8BitDo controller connected');
		expect(describeGamepadConnection({ id: 'Xbox Controller' })).toBe('Controller connected');
	});
});

describe('formatGamepadDeviceInfo()', () => {
	it('includes mapping and axis/button counts', () => {
		const info = formatGamepadDeviceInfo({
			id: '2dc8-6000-8BitDo Controller',
			mapping: '',
			buttons: new Array(16).fill({ pressed: false, value: 0 }),
			axes: [0, 0, 0, 0, 0, 0],
		});
		expect(info).toContain('vendor 0x2dc8');
		expect(info).toContain('16 buttons');
		expect(info).toContain('6 axes');
	});

	it('asks the player to interact before pressing buttons when not primed', () => {
		const info = formatGamepadDeviceInfo(null, { primed: false });
		expect(info).toContain('click or tap this page');
		expect(info).toContain('press any controller button or move a stick');
	});
});

describe('isSafariBrowser()', () => {
	const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
	const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
	const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
	const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

	it('detects Safari and excludes Chrome/Android', () => {
		expect(isSafariBrowser(SAFARI_MAC)).toBe(true);
		expect(isSafariBrowser(IOS_SAFARI)).toBe(true);
		expect(isSafariBrowser(CHROME_MAC)).toBe(false);
		expect(isSafariBrowser(ANDROID_CHROME)).toBe(false);
	});
});

describe('getGamepadActivationHint()', () => {
	const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
	const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

	it('returns empty text when a pad is connected', () => {
		expect(getGamepadActivationHint({ connected: true })).toBe('');
	});

	it('asks for page interaction before controller input when not primed', () => {
		const hint = getGamepadActivationHint({ primed: false, connected: false });
		expect(hint).toContain('Click or tap this page first');
		expect(hint).toContain('press any controller button or move a stick');
	});

	it('includes Safari guidance when the UA is Safari', () => {
		const hint = getGamepadActivationHint({
			primed: false,
			connected: false,
			userAgent: SAFARI_MAC,
		});
		expect(hint).toContain('Safari');
		expect(hint).toContain('gamepadconnected');
		expect(hint).toContain('HTTPS or localhost');
	});

	it('omits Safari guidance for non-Safari browsers', () => {
		const hint = getGamepadActivationHint({
			primed: false,
			connected: false,
			userAgent: CHROME_MAC,
		});
		expect(hint).not.toContain('Safari');
	});
});
