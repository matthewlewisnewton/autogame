import {
	getCalibrationGamepad,
	getConnectedGamepads,
	is8BitDo64Gamepad,
	is8BitDoGamepad,
	hasStandardGamepadMapping,
	describeGamepadConnection,
	formatGamepadDeviceInfo,
} from './gamepad-detect.js';
import {
	resolveGamepadProfile,
	describeActiveGamepadProfile,
	read8BitDo64CButtonState,
	uses8BitDo64DigitalCButtons,
	EIGHTBITDO_64_TRIGGER_BUTTON_INDICES,
} from './gamepad-profiles.js';
import { applyDeadzone } from './gamepad.js';
import { getGamepadConfig, getGamepadProfileSetting, patchSettings } from './settings.js';

/** @typedef {{
 *   statusEl: HTMLElement | null,
 *   deviceIdEl: HTMLElement | null,
 *   activationHintEl: HTMLElement | null,
 *   profileSelectEl: HTMLSelectElement | null,
 *   profileHintEl: HTMLElement | null,
 *   deadzoneSliderEl: HTMLInputElement | null,
 *   deadzoneValueEl: HTMLElement | null,
 *   moveStickSelectEl: HTMLSelectElement | null,
 *   leftDotEl: HTMLElement | null,
 *   leftValuesEl: HTMLElement | null,
 *   secondaryStickPanelEl: HTMLElement | null,
 *   secondaryStickLabelEl: HTMLElement | null,
 *   triggerAxesEl: HTMLElement | null,
 *   rightDotEl: HTMLElement | null,
 *   rightValuesEl: HTMLElement | null,
 *   buttonGridEl: HTMLElement | null,
 * }} CalibrationElements */

/** @type {CalibrationElements} */
let els = {
	statusEl: null,
	deviceIdEl: null,
	activationHintEl: null,
	profileSelectEl: null,
	profileHintEl: null,
	deadzoneSliderEl: null,
	deadzoneValueEl: null,
	moveStickSelectEl: null,
	leftDotEl: null,
	leftValuesEl: null,
	secondaryStickPanelEl: null,
	secondaryStickLabelEl: null,
	triggerAxesEl: null,
	rightDotEl: null,
	rightValuesEl: null,
	buttonGridEl: null,
};

let polling = false;
let rafId = 0;
/** @type {HTMLElement[]} */
let buttonCells = [];
/** @type {Array<{ el: HTMLElement, direction: 'up' | 'down' | 'left' | 'right' }>} */
let cButtonCells = [];

/**
 * @param {CalibrationElements} elements
 */
export function initControllerCalibration(elements) {
	els = { ...els, ...elements };
	buildButtonGrid();
	wireControls();
}

function getActiveCalibrationProfile(gamepad) {
	return resolveGamepadProfile(gamepad, getGamepadProfileSetting());
}

function buildButtonGrid() {
	if (!els.buttonGridEl) return;
	const gamepad = getCalibrationGamepad();
	const profile = getActiveCalibrationProfile(gamepad);
	els.buttonGridEl.innerHTML = '';
	buttonCells = profile.buttonLabels.map(({ index, label }) => {
		const cell = document.createElement('div');
		cell.className = 'calibration-button';
		cell.dataset.index = String(index);
		cell.innerHTML = `<span class="calibration-button-label">${label}</span>`;
		els.buttonGridEl.appendChild(cell);
		return cell;
	});
	cButtonCells = (profile.cButtonLabels ?? []).map(({ direction, label }) => {
		const cell = document.createElement('div');
		cell.className = 'calibration-button calibration-c-button';
		cell.dataset.direction = direction;
		cell.innerHTML = `<span class="calibration-button-label">${label}</span>`;
		els.buttonGridEl.appendChild(cell);
		return { el: cell, direction };
	});
}

function wireControls() {
	if (els.deadzoneSliderEl) {
		els.deadzoneSliderEl.addEventListener('input', () => {
			const value = Number(els.deadzoneSliderEl.value);
			if (els.deadzoneValueEl) {
				els.deadzoneValueEl.textContent = value.toFixed(2);
			}
			patchSettings({ gamepad: { deadzone: value } });
		});
	}
	if (els.moveStickSelectEl) {
		els.moveStickSelectEl.addEventListener('change', () => {
			patchSettings({ gamepad: { moveStick: els.moveStickSelectEl.value } });
		});
	}
	if (els.profileSelectEl) {
		els.profileSelectEl.addEventListener('change', () => {
			patchSettings({ gamepad: { profile: els.profileSelectEl.value } });
			buildButtonGrid();
		});
	}
}

export function syncControllerCalibrationForm() {
	const cfg = getGamepadConfig();
	const gamepad = getCalibrationGamepad();
	const profile = getActiveCalibrationProfile(gamepad);
	if (els.deadzoneSliderEl) {
		const deadzone = typeof cfg.deadzone === 'number' ? cfg.deadzone : 0.15;
		els.deadzoneSliderEl.value = String(deadzone);
		if (els.deadzoneValueEl) els.deadzoneValueEl.textContent = deadzone.toFixed(2);
	}
	if (els.moveStickSelectEl) {
		const moveStick = cfg.moveStick ?? profile.moveStick ?? 'left';
		els.moveStickSelectEl.value = moveStick === 'right' ? 'right' : 'left';
	}
	if (els.profileSelectEl) {
		els.profileSelectEl.value = getGamepadProfileSetting();
	}
	if (els.profileHintEl) {
		els.profileHintEl.textContent = describeActiveGamepadProfile(gamepad, getGamepadProfileSetting())
			+ (profile.id === '8bitdo-64' ? ` — ${profile.description}` : '');
	}
	if (els.secondaryStickPanelEl) {
		const hideSecondary = profile.id === '8bitdo-64' && uses8BitDo64DigitalCButtons();
		els.secondaryStickPanelEl.hidden = hideSecondary;
	}
	if (els.secondaryStickLabelEl && !els.secondaryStickPanelEl?.hidden) {
		els.secondaryStickLabelEl.textContent = profile.cStickLabel ?? 'Right stick';
	}
	if (els.triggerAxesEl && profile.id === '8bitdo-64') {
		if (!gamepad) {
			els.triggerAxesEl.hidden = true;
		} else {
			els.triggerAxesEl.hidden = false;
			const z = gamepad.buttons[EIGHTBITDO_64_TRIGGER_BUTTON_INDICES[0]];
			const r = gamepad.buttons[EIGHTBITDO_64_TRIGGER_BUTTON_INDICES[1]];
			const zValue = z?.value ?? 0;
			const rValue = r?.value ?? 0;
			const cX = gamepad.axes[2] ?? 0;
			const cY = gamepad.axes[3] ?? 0;
			els.triggerAxesEl.textContent =
				`C cluster axes 2/3: ${cX.toFixed(2)}, ${cY.toFixed(2)} · Z/R triggers: btn ${EIGHTBITDO_64_TRIGGER_BUTTON_INDICES[0]} ${zValue.toFixed(2)}, btn ${EIGHTBITDO_64_TRIGGER_BUTTON_INDICES[1]} ${rValue.toFixed(2)}`;
		}
	}
	buildButtonGrid();
	updateStatusDisplay(gamepad);
}

function updateStatusDisplay(gamepad) {
	const profile = getActiveCalibrationProfile(gamepad);
	if (els.statusEl) {
		els.statusEl.textContent = describeGamepadConnection(gamepad);
		els.statusEl.dataset.connected = gamepad ? 'true' : 'false';
		els.statusEl.dataset.eightbitdo = gamepad && is8BitDoGamepad(gamepad) ? 'true' : 'false';
		els.statusEl.dataset.eightbitdo64 = gamepad && is8BitDo64Gamepad(gamepad) ? 'true' : 'false';
	}
	if (els.deviceIdEl) {
		els.deviceIdEl.textContent = formatGamepadDeviceInfo(gamepad);
	}
	if (els.activationHintEl) {
		const needsActivation = getConnectedGamepads().length === 0;
		els.activationHintEl.hidden = !needsActivation;
		els.activationHintEl.textContent = needsActivation
			? 'Press any button or move a stick on your controller. Browsers only expose gamepads after user interaction (GamePad API privacy rule).'
			: '';
	}
	if (els.statusEl && gamepad && is8BitDoGamepad(gamepad) && !hasStandardGamepadMapping(gamepad)) {
		els.statusEl.title = profile.id === '8bitdo-64'
			? '8BitDo 64 uses digital C-buttons (grid below). Z lock-on and L modifier map to btn 8 and btn 6.'
			: '8BitDo pads often use non-standard browser mapping. Verify buttons in the grid below match what you press.';
	} else if (els.statusEl) {
		els.statusEl.title = '';
	}
}

function updateStickVisual(dotEl, valuesEl, rawX, rawY, deadzone) {
	if (!dotEl || !valuesEl) return;
	const x = Number.isFinite(rawX) ? rawX : 0;
	const y = Number.isFinite(rawY) ? rawY : 0;
	const adjustedX = applyDeadzone(x, deadzone);
	const adjustedY = applyDeadzone(y, deadzone);
	const offsetX = adjustedX * 42;
	const offsetY = adjustedY * 42;
	dotEl.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
	valuesEl.textContent = `${x.toFixed(2)}, ${y.toFixed(2)} · dz ${adjustedX.toFixed(2)}, ${adjustedY.toFixed(2)}`;
}

function updateButtonGrid(gamepad, profile) {
	if (!gamepad?.buttons?.length || buttonCells.length === 0) return;
	for (const cell of buttonCells) {
		const index = Number(cell.dataset.index);
		const btn = gamepad.buttons[index];
		const pressed = btn?.pressed || (btn?.value ?? 0) > 0.5;
		cell.classList.toggle('pressed', pressed);
	}

	if (profile.id === '8bitdo-64' && cButtonCells.length > 0) {
		const cState = read8BitDo64CButtonState(gamepad, 0.3);
		for (const { el, direction } of cButtonCells) {
			el.classList.toggle('pressed', cState[direction]);
		}
	}
}

function getSecondaryStickValues(gamepad, profile) {
	if (profile.id === '8bitdo-64' && uses8BitDo64DigitalCButtons()) {
		return { x: 0, y: 0 };
	}
	return {
		x: gamepad.axes[2] ?? 0,
		y: gamepad.axes[3] ?? 0,
	};
}

function calibrationFrame() {
	if (!polling) return;
	const cfg = getGamepadConfig();
	const deadzone = typeof cfg.deadzone === 'number' ? cfg.deadzone : 0.15;
	const gamepad = getCalibrationGamepad();
	const profile = getActiveCalibrationProfile(gamepad);
	updateStatusDisplay(gamepad);
	if (gamepad) {
		updateStickVisual(
			els.leftDotEl,
			els.leftValuesEl,
			gamepad.axes[0] ?? 0,
			gamepad.axes[1] ?? 0,
			deadzone,
		);
		const secondary = getSecondaryStickValues(gamepad, profile);
		updateStickVisual(
			els.rightDotEl,
			els.rightValuesEl,
			secondary.x,
			secondary.y,
			deadzone,
		);
		updateButtonGrid(gamepad, profile);
	} else if (buttonCells.length) {
		for (const cell of buttonCells) cell.classList.remove('pressed');
	}
	rafId = requestAnimationFrame(calibrationFrame);
}

export function startControllerCalibration() {
	if (polling) return;
	syncControllerCalibrationForm();
	polling = true;
	rafId = requestAnimationFrame(calibrationFrame);
}

export function stopControllerCalibration() {
	polling = false;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = 0;
	}
}

export function onGamepadConnectChange(_gamepad) {
	if (!polling) return;
	syncControllerCalibrationForm();
}
