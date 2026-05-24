/**
 * Inject mock gamepad(s) for navigator.getGamepads() in tests.
 */

/** @type {Map<number, object>} */
const mockPads = new Map();
let originalGetGamepads = null;

/**
 * @param {number} index
 * @param {{ buttons?: Array<{ pressed?: boolean, value?: number }>, axes?: number[] }} spec
 */
export function mockGamepad(index, spec = {}) {
	const buttons = (spec.buttons || []).map((b) => ({
		pressed: !!b.pressed,
		value: b.value ?? (b.pressed ? 1 : 0)
	}));
	const axes = spec.axes || [0, 0, 0, 0];
	mockPads.set(index, {
		index,
		connected: true,
		id: `Mock Gamepad ${index}`,
		mapping: 'standard',
		buttons,
		axes,
		timestamp: performance.now()
	});
}

export function clearMockGamepads() {
	mockPads.clear();
}

export function installGamepadMock() {
	if (!originalGetGamepads) {
		originalGetGamepads = navigator.getGamepads?.bind(navigator);
	}
	navigator.getGamepads = () => {
		const arr = [];
		for (const [idx, pad] of mockPads) {
			arr[idx] = pad;
		}
		return arr;
	};
}

export function uninstallGamepadMock() {
	if (originalGetGamepads) {
		navigator.getGamepads = originalGetGamepads;
		originalGetGamepads = null;
	}
	mockPads.clear();
}
