/** @typedef {'up' | 'down' | 'left' | 'right'} CButtonDirection */

/** @type {Record<CButtonDirection, number>} */
const C_BUTTON_ROTATION = {
	up: 0,
	right: 90,
	down: 180,
	left: -90,
};

/**
 * Plain-text label for accessibility and tests.
 * @param {CButtonDirection} direction
 * @returns {string}
 */
export function getCButtonAccessibleLabel(direction) {
	const labels = {
		up: 'C up',
		down: 'C down',
		left: 'C left',
		right: 'C right',
	};
	return labels[direction] ?? 'C button';
}

/**
 * Inline SVG triangle oriented like an N64 C-button.
 * @param {CButtonDirection} direction
 * @param {{ className?: string, size?: number }} [options]
 * @returns {string}
 */
export function renderCButtonMark(direction, options = {}) {
	const { className = 'c-button-mark', size = 12 } = options;
	const rotation = C_BUTTON_ROTATION[direction] ?? 0;
	const aria = getCButtonAccessibleLabel(direction);
	return (
		`<span class="${className}" role="img" aria-label="${aria}">`
		+ `<svg class="c-button-mark__svg" width="${size}" height="${size}" viewBox="0 0 12 12" aria-hidden="true">`
		+ `<polygon class="c-button-mark__shape" points="6,1.5 10.5,10 1.5,10" transform="rotate(${rotation} 6 6)" />`
		+ '</svg></span>'
	);
}
