/** Gamepad identification helpers for settings / calibration UI.
 *
 * Browser APIs (see MDN / W3C Gamepad spec):
 * - navigator.getGamepads() — poll connected pads each frame after user gesture
 * - gamepadconnected / gamepaddisconnected — connect lifecycle on window
 * - Gamepad { id, index, connected, mapping, axes[], buttons[] }
 *
 * 8BitDo USB/BT pads use vendor id 0x2dc8. Browsers often expose them with
 * mapping === "" (non-standard) rather than "standard", so button indices follow
 * the browser's raw HID layout, not printed A/B/X/Y labels.
 */

/** USB vendor ID for 8BitDo controllers (decimal 11720). */
export const EIGHTBITDO_VENDOR_ID = 0x2dc8;

/** USB product id for the 8BitDo 64 (SDL GameControllerDB 0x1930). */
export const EIGHTBITDO_64_PRODUCT_ID = 0x1930;

/** Bluetooth product id for the 8BitDo 64 (browser reports 0x3019). */
export const EIGHTBITDO_64_BT_PRODUCT_ID = 0x3019;

const EIGHTBITDO_64_PRODUCT_IDS = new Set([
	EIGHTBITDO_64_PRODUCT_ID,
	EIGHTBITDO_64_BT_PRODUCT_ID,
]);

const EIGHTBITDO_NAME_PATTERN = /8[\s-]?bit[\s-]?do/i;
const EIGHTBITDO_64_NAME_PATTERN = /8[\s-]?bit[\s-]?do\s*64|64\s*(bluetooth\s*)?controller/i;

/** @typedef {{ name: string, vendorId: number | null, productId: number | null, xinput?: boolean }} ParsedGamepadId */

/**
 * Parse gamepad.id across Chrome/Opera, Firefox, and Safari formats.
 * Chrome: "8Bitdo SF30 Pro (Vendor: 2dc8 Product: 6000)"
 * Firefox: "2dc8-6000-8Bitdo SF30 Pro"
 * @param {string | undefined | null} id
 * @returns {ParsedGamepadId | null}
 */
export function parseGamepadId(id) {
	if (!id) return null;

	const chromeMatch = id.match(/^(.*)\s*\((?:.*)?vendor:?\s*([0-9a-f]+)\s+product:?\s*([0-9a-f]+)\s*\)\s*$/i);
	if (chromeMatch) {
		return {
			name: chromeMatch[1].trim(),
			vendorId: parseInt(chromeMatch[2], 16),
			productId: parseInt(chromeMatch[3], 16),
		};
	}

	const firefoxMatch = id.match(/^([0-9a-f]+)-([0-9a-f]+)-\s*(.*)\s*$/i);
	if (firefoxMatch) {
		return {
			name: firefoxMatch[3].trim(),
			vendorId: parseInt(firefoxMatch[1], 16),
			productId: parseInt(firefoxMatch[2], 16),
		};
	}

	if (/^\s*xinput\s*$/i.test(id) || /\(xinput standard gamepad\)/i.test(id)) {
		return { name: 'XInput Controller', vendorId: null, productId: null, xinput: true };
	}

	const vendorMatch = id.match(/vendor:?\s*([0-9a-f]+)/i);
	const productMatch = id.match(/product:?\s*([0-9a-f]+)/i);
	return {
		name: id.replace(/\s*\(.*\)/, '').trim() || id,
		vendorId: vendorMatch ? parseInt(vendorMatch[1], 16) : null,
		productId: productMatch ? parseInt(productMatch[1], 16) : null,
	};
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {boolean}
 */
export function is8BitDoGamepad(gamepad) {
	if (!gamepad?.id) return false;
	if (EIGHTBITDO_NAME_PATTERN.test(gamepad.id)) return true;
	const parsed = parseGamepadId(gamepad.id);
	return parsed?.vendorId === EIGHTBITDO_VENDOR_ID;
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {boolean}
 */
export function is8BitDo64Gamepad(gamepad) {
	if (!gamepad?.id) return false;
	if (EIGHTBITDO_64_NAME_PATTERN.test(gamepad.id)) return true;
	const parsed = parseGamepadId(gamepad.id);
	return parsed?.vendorId === EIGHTBITDO_VENDOR_ID
		&& parsed?.productId != null
		&& EIGHTBITDO_64_PRODUCT_IDS.has(parsed.productId);
}

/**
 * Bluetooth 8BitDo 64 — C↑/C↓ map to axis 5 instead of discrete buttons 2/3.
 * @param {Gamepad | null | undefined} gamepad
 * @returns {boolean}
 */
export function is8BitDo64BluetoothGamepad(gamepad) {
	if (!gamepad?.id) return false;
	const parsed = parseGamepadId(gamepad.id);
	if (parsed?.productId === EIGHTBITDO_64_BT_PRODUCT_ID) return true;
	return /product:\s*3019/i.test(gamepad.id);
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {number | null}
 */
export function get8BitDo64VerticalCAxisIndex(gamepad) {
	return is8BitDo64BluetoothGamepad(gamepad) ? 5 : null;
}

/**
 * W3C standard mapping uses positional face buttons (south/east/west/north),
 * which is what the game expects when mapping === "standard".
 * @param {Gamepad | null | undefined} gamepad
 * @returns {boolean}
 */
export function hasStandardGamepadMapping(gamepad) {
	return gamepad?.mapping === 'standard';
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {string}
 */
export function describeGamepadMapping(gamepad) {
	if (!gamepad) return '';
	if (gamepad.mapping === 'standard') return 'W3C standard mapping';
	if (gamepad.mapping === '') {
		return is8BitDoGamepad(gamepad)
			? 'non-standard mapping (common for 8BitDo in browsers — use calibration to verify indices)'
			: 'non-standard mapping (browser raw layout)';
	}
	return `${gamepad.mapping} mapping`;
}

/**
 * @returns {Gamepad[]}
 */
export function getConnectedGamepads() {
	if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
	return Array.from(navigator.getGamepads()).filter(Boolean);
}

/**
 * Prefer an attached 8BitDo pad; otherwise return the first connected pad.
 * @returns {Gamepad | null}
 */
export function getCalibrationGamepad() {
	const pads = getConnectedGamepads();
	if (pads.length === 0) return null;
	return pads.find(is8BitDo64Gamepad) ?? pads.find(is8BitDoGamepad) ?? pads[0];
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {string}
 */
export function describeGamepadConnection(gamepad) {
	if (!gamepad) return 'No controller detected';
	if (is8BitDo64Gamepad(gamepad)) return '8BitDo 64 controller connected';
	if (is8BitDoGamepad(gamepad)) return '8BitDo controller connected';
	return 'Controller connected';
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {string}
 */
export function formatGamepadDeviceInfo(gamepad) {
	if (!gamepad) {
		return 'Connect a USB or Bluetooth gamepad, then press any button or move a stick so the browser can expose it.';
	}
	const parsed = parseGamepadId(gamepad.id);
	const parts = [gamepad.id || 'Unknown device'];
	if (parsed?.vendorId != null) {
		const product = parsed.productId != null ? ` product 0x${parsed.productId.toString(16)}` : '';
		parts.push(`vendor 0x${parsed.vendorId.toString(16)}${product}`);
	}
	parts.push(describeGamepadMapping(gamepad));
	parts.push(`${gamepad.buttons.length} buttons · ${gamepad.axes.length} axes`);
	return parts.join(' · ');
}

/** W3C standard-layout labels by physical position (not printed face labels). */
export const STANDARD_GAMEPAD_BUTTON_LABELS = [
	'South (btn 0)',
	'East (btn 1)',
	'West (btn 2)',
	'North (btn 3)',
	'L1 / LB',
	'R1 / RB',
	'L2 / LT',
	'R2 / RT',
	'Select / Back',
	'Start',
	'L3',
	'R3',
	'D-pad Up',
	'D-pad Down',
	'D-pad Left',
	'D-pad Right',
];
