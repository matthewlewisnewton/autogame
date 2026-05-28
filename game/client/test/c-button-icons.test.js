import { describe, it, expect } from 'vitest';
import {
	getCButtonAccessibleLabel,
	renderCButtonMark,
} from '../c-button-icons.js';

describe('c-button-icons', () => {
	it('renders directional SVG marks with accessible labels', () => {
		const up = renderCButtonMark('up');
		expect(up).toContain('c-button-mark');
		expect(up).toContain('rotate(0 6 6)');
		expect(up).toContain('aria-label="C up"');

		const right = renderCButtonMark('right', { size: 16 });
		expect(right).toContain('width="16"');
		expect(right).toContain('rotate(90 6 6)');

		expect(renderCButtonMark('down')).toContain('rotate(180 6 6)');
		expect(renderCButtonMark('left')).toContain('rotate(-90 6 6)');
	});

	it('maps directions to plain-text labels', () => {
		expect(getCButtonAccessibleLabel('up')).toBe('C up');
		expect(getCButtonAccessibleLabel('down')).toBe('C down');
		expect(getCButtonAccessibleLabel('left')).toBe('C left');
		expect(getCButtonAccessibleLabel('right')).toBe('C right');
	});
});
