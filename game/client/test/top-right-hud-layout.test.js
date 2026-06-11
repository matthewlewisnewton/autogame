import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import { syncLockOnInfoPanel } from '../lock-on-info-panel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

const require = createRequire(import.meta.url);
const { buildEnemyDisplayCatalog } = require('../../server/enemyDisplay.js');
const enemyCatalog = buildEnemyDisplayCatalog();

const VIEWPORTS = [
	{ width: 1280, height: 800, label: '1280x800' },
	{ width: 1920, height: 1080, label: '1920x1080' },
];

const DODGE_ROLL_DEF = { id: 'dodge_roll', name: 'Dodge Roll', cooldownMs: 800 };

/** Axis-aligned overlap using getBoundingClientRect (jsdom has no layout engine). */
function rectsOverlap(a, b) {
	const ra = a.getBoundingClientRect();
	const rb = b.getBoundingClientRect();
	if (ra.width <= 0 || ra.height <= 0 || rb.width <= 0 || rb.height <= 0) return false;
	return ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top;
}

function extractCssVars(cssText) {
	const vars = new Map();
	const rootMatch = cssText.match(/:root\s*\{([^}]+)\}/);
	if (!rootMatch) return vars;
	for (const decl of rootMatch[1].split(';')) {
		const colon = decl.indexOf(':');
		if (colon === -1) continue;
		const prop = decl.slice(0, colon).trim();
		const val = decl.slice(colon + 1).trim();
		if (prop.startsWith('--') && val) vars.set(prop, val);
	}
	return vars;
}

function parseCssLength(raw, ctx, depth = 0) {
	if (!raw || depth > 8) return 0;
	const value = String(raw).trim();
	if (!value || value === 'auto' || value === 'none') return 0;
	if (value.endsWith('px')) return Number.parseFloat(value);
	if (value.startsWith('var(')) {
		const inner = value.slice(4, -1).split(',')[0].trim();
		const fallback = value.includes(',') ? value.slice(value.indexOf(',') + 1, -1).trim() : '0px';
		return parseCssLength(ctx.vars.get(inner) ?? fallback, ctx, depth + 1);
	}
	if (value.startsWith('calc(')) {
		const inner = value.slice(5, -1).replace(/\s+/g, '');
		const vwMatch = inner.match(/([+-]?[\d.]+)vw/);
		const pxMatch = inner.match(/([+-]?[\d.]+)px/g);
		let total = 0;
		if (vwMatch) total += (Number.parseFloat(vwMatch[1]) / 100) * ctx.viewportWidth;
		if (pxMatch) {
			for (const token of pxMatch) total += Number.parseFloat(token);
		}
		return total;
	}
	if (value.startsWith('min(')) {
		const inner = value.slice(4, -1);
		const parts = inner.split(',').map((p) => parseCssLength(p.trim(), ctx, depth + 1)).filter((n) => n > 0);
		return parts.length ? Math.min(...parts) : 0;
	}
	return 0;
}

function domRect(left, top, width, height) {
	return {
		x: left,
		y: top,
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
	};
}

function isVisible(el, win) {
	if (!el || el.nodeType !== 1) return false;
	if (el.classList.contains('hidden')) return false;
	const style = win.getComputedStyle(el);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function measureElementWidth(el, win, ctx) {
	const style = win.getComputedStyle(el);
	const explicit = parseCssLength(style.width, ctx);
	if (explicit > 0) return explicit;
	if (el.id === 'key-item-indicator') return 150;
	if (el.tagName === 'BUTTON') return 40;
	return 0;
}

function measureElementHeight(el, win, ctx) {
	if (!isVisible(el, win)) return 0;
	const style = win.getComputedStyle(el);
	const explicit = parseCssLength(style.height, ctx);
	if (explicit > 0) return explicit;

	if (el.id === 'app-toolbar') {
		const buttons = [...el.querySelectorAll('button')].filter((btn) => isVisible(btn, win));
		return buttons.length ? 40 : 0;
	}
	if (el.tagName === 'BUTTON') return 40;
	if (el.id === 'key-item-indicator') {
		const name = el.querySelector('.key-item-hud-name')?.textContent?.trim();
		return name ? 46 : 0;
	}
	if (el.id === 'lock-on-info-panel') {
		const statRows = el.querySelectorAll('.lock-on-stat-row').length || 3;
		const desc = el.querySelector('#lock-on-target-description')?.textContent?.trim();
		return 16 + 22 + 18 + statRows * 18 + (desc ? 36 : 0) + 16;
	}
	if (el.id === 'quest-comms-log') {
		const lines = Math.max(el.querySelectorAll('.quest-comms-line').length, 1);
		return 16 + lines * 18;
	}
	if (el.classList.contains('quest-comms-toast')) {
		const text = el.textContent || '';
		const lineCount = text.length > 72 ? 2 : 1;
		return 16 + lineCount * 17;
	}
	return 0;
}

function layoutFixedBox(el, win, ctx, rects) {
	if (!isVisible(el, win)) return;
	const style = win.getComputedStyle(el);
	const position = style.position;
	if (position !== 'fixed' && position !== 'absolute') return;

	const width = measureElementWidth(el, win, ctx);
	const height = measureElementHeight(el, win, ctx);
	if (width <= 0 || height <= 0) return;

	const top = parseCssLength(style.top, ctx);
	const right = parseCssLength(style.right, ctx);
	const left = parseCssLength(style.left, ctx);

	let x = left;
	if (right > 0 || (style.right && style.right !== 'auto')) {
		x = ctx.viewportWidth - right - width;
	}
	if (Number.isNaN(x) || (style.left === 'auto' && style.right === 'auto')) {
		x = 0;
	}

	rects.set(el, domRect(x, top, width, height));
}

function layoutFlexChildren(container, win, ctx, rects, startX, startY, gap) {
	let y = startY;
	const children = [...container.children];
	for (const child of children) {
		if (!isVisible(child, win)) continue;
		const childStyle = win.getComputedStyle(child);
		const childPos = childStyle.position;

		if (childPos === 'absolute' || childPos === 'fixed') {
			layoutFixedBox(child, win, ctx, rects);
			continue;
		}

		const width = measureElementWidth(child, win, ctx);
		const height = measureElementHeight(child, win, ctx);
		if (width <= 0 || height <= 0) continue;

		const x = startX + Math.max(0, measureElementWidth(container, win, ctx) - width);
		rects.set(child, domRect(x, y, width, height));
		y += height + gap;
	}
}

function layoutToolbar(toolbar, win, ctx, rects) {
	if (!isVisible(toolbar, win)) return;
	const style = win.getComputedStyle(toolbar);
	const top = parseCssLength(style.top, ctx);
	const right = parseCssLength(style.right, ctx);
	const gap = parseCssLength(style.gap, ctx) || 8;

	const buttons = [...toolbar.querySelectorAll('button')].filter((btn) => isVisible(btn, win));
	if (!buttons.length) return;

	const buttonWidth = 40;
	const buttonHeight = 40;
	const toolbarWidth = buttons.length * buttonWidth + Math.max(0, buttons.length - 1) * gap;
	const toolbarLeft = ctx.viewportWidth - right - toolbarWidth;
	rects.set(toolbar, domRect(toolbarLeft, top, toolbarWidth, buttonHeight));

	let x = toolbarLeft;
	for (const btn of buttons) {
		rects.set(btn, domRect(x, top, buttonWidth, buttonHeight));
		x += buttonWidth + gap;
	}
}

function layoutTopRightStack(stack, win, ctx, rects) {
	if (!isVisible(stack, win)) return;
	const style = win.getComputedStyle(stack);
	const top = parseCssLength(style.top, ctx);
	const right = parseCssLength(style.right, ctx);
	const gap = parseCssLength(style.gap, ctx) || 8;

	const children = [...stack.children].filter((child) => isVisible(child, win));
	const childWidths = children.map((child) => measureElementWidth(child, win, ctx));
	const stackWidth = childWidths.length ? Math.max(...childWidths) : 0;
	const stackLeft = ctx.viewportWidth - right - stackWidth;

	layoutFlexChildren(stack, win, ctx, rects, stackLeft, top, gap);

	let totalHeight = 0;
	for (const child of children) {
		const rect = rects.get(child);
		if (rect) totalHeight += rect.height + gap;
	}
	if (totalHeight > 0) totalHeight -= gap;
	if (stackWidth > 0 && totalHeight > 0) {
		rects.set(stack, domRect(stackLeft, top, stackWidth, totalHeight));
	}
}

function computeHudLayoutRects(win) {
	const rects = new Map();
	const ctx = {
		viewportWidth: win.innerWidth,
		viewportHeight: win.innerHeight,
		vars: extractCssVars(styleCss),
	};

	const toolbar = win.document.getElementById('app-toolbar');
	const stack = win.document.getElementById('top-right-hud-stack');
	if (toolbar) layoutToolbar(toolbar, win, ctx, rects);
	if (stack) layoutTopRightStack(stack, win, ctx, rects);

	// Legacy absolute anchors (pre-fix) lived on #ui, not inside the flex stack.
	for (const id of ['key-item-indicator', 'lock-on-info-panel', 'quest-comms-log']) {
		const el = win.document.getElementById(id);
		if (!el || rects.has(el)) continue;
		layoutFixedBox(el, win, ctx, rects);
	}

	for (const toast of win.document.querySelectorAll('.quest-comms-toast')) {
		if (!rects.has(toast)) layoutFixedBox(toast, win, ctx, rects);
	}

	return rects;
}

function installLayoutPolyfill(win) {
	const nativeGetRect = win.Element.prototype.getBoundingClientRect;
	win.Element.prototype.getBoundingClientRect = function getBoundingClientRectPolyfill() {
		const rects = computeHudLayoutRects(win);
		if (rects.has(this)) return { ...rects.get(this) };
		return nativeGetRect.call(this);
	};
}

function mountHudFixture(viewport) {
	const parsed = new JSDOM(indexHtml).window.document;
	document.documentElement.innerHTML = parsed.documentElement.innerHTML;

	let styleEl = document.getElementById('top-right-hud-layout-test-style');
	if (!styleEl) {
		styleEl = document.createElement('style');
		styleEl.id = 'top-right-hud-layout-test-style';
		document.head.appendChild(styleEl);
	}
	styleEl.textContent = styleCss;

	window.innerWidth = viewport.width;
	window.innerHeight = viewport.height;
	installLayoutPolyfill(window);

	document.body.setAttribute('data-phase', 'playing');
	const ui = document.getElementById('ui');
	if (ui) ui.style.display = 'block';
}

function showInRunToolbar() {
	const toolbar = document.getElementById('app-toolbar');
	toolbar?.classList.remove('hidden');
	document.getElementById('level-settings-btn')?.classList.remove('hidden');
	return toolbar;
}

function populateKeyItemDodgeRoll() {
	const indicator = document.getElementById('key-item-indicator');
	indicator.classList.add('ready');
	indicator.setAttribute('data-key-item-id', 'dodge_roll');
	indicator.querySelector('.key-item-hud-name').textContent = 'Dodge Roll';
	indicator.querySelector('.key-item-hud-keybind').textContent = 'E';
	return indicator;
}

function populateLockOnPanel() {
	const panel = document.getElementById('lock-on-info-panel');
	const enemy = {
		type: 'grunt',
		hp: 62,
		maxHp: 100,
		attackDamage: 10,
		attackStyle: 'radial',
		chaseSpeed: 2.5,
	};
	syncLockOnInfoPanel({
		panelEl: panel,
		nameEl: document.getElementById('lock-on-target-name'),
		variantEl: document.getElementById('lock-on-target-variant'),
		hpEl: document.getElementById('lock-on-target-hp'),
		statsEl: document.getElementById('lock-on-target-stats'),
		descEl: document.getElementById('lock-on-target-description'),
		enemy,
		catalog: enemyCatalog,
	});
	return panel;
}

function appendCommsLogLine(speaker, text, seq = '01') {
	const log = document.getElementById('quest-comms-log');
	log.classList.remove('hidden');
	log.setAttribute('aria-hidden', 'false');

	const line = document.createElement('div');
	line.className = 'quest-comms-line';

	const seqEl = document.createElement('span');
	seqEl.className = 'quest-comms-line-seq';
	seqEl.textContent = seq;

	const bodyEl = document.createElement('div');
	bodyEl.className = 'quest-comms-line-body';

	const speakerEl = document.createElement('span');
	speakerEl.className = 'quest-comms-line-speaker';
	speakerEl.textContent = `${speaker}:`;

	const textEl = document.createElement('span');
	textEl.className = 'quest-comms-line-text';
	textEl.textContent = text;

	bodyEl.appendChild(speakerEl);
	bodyEl.appendChild(textEl);
	line.appendChild(seqEl);
	line.appendChild(bodyEl);
	log.appendChild(line);
	return log;
}

function assertNoPairwiseOverlap(elements, label) {
	const visible = elements.filter((el) => {
		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	});
	for (let i = 0; i < visible.length; i += 1) {
		for (let j = i + 1; j < visible.length; j += 1) {
			expect(
				rectsOverlap(visible[i], visible[j]),
				`${label}: expected no overlap between #${visible[i].id || visible[i].className} and #${visible[j].id || visible[j].className}`,
			).toBe(false);
		}
	}
}

function playingGameState() {
	return {
		gamePhase: 'playing',
		players: { p1: { id: 'p1', hp: 100, hand: [], equippedKeyItemId: 'dodge_roll' } },
		run: { questId: 'training_caverns', questTier: 1, objective: { type: 'defeat_enemies' } },
	};
}

describe('top-right HUD layout (collision regression)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		document.getElementById('top-right-hud-layout-test-style')?.remove();
	});

	describe('rectsOverlap helper', () => {
		it('detects intersection and ignores zero-area rects', () => {
			const a = { getBoundingClientRect: () => domRect(0, 0, 10, 10) };
			const b = { getBoundingClientRect: () => domRect(5, 5, 10, 10) };
			const c = { getBoundingClientRect: () => domRect(20, 0, 10, 10) };
			const empty = { getBoundingClientRect: () => domRect(0, 0, 0, 0) };
			expect(rectsOverlap(a, b)).toBe(true);
			expect(rectsOverlap(a, c)).toBe(false);
			expect(rectsOverlap(a, empty)).toBe(false);
		});
	});

	describe('pre-fix absolute anchors would overlap (regression guard)', () => {
		it('flags toolbar vs key-item collision at the old top:36px anchor', () => {
			mountHudFixture(VIEWPORTS[0]);
			showInRunToolbar();
			const indicator = populateKeyItemDodgeRoll();
			indicator.style.position = 'absolute';
			indicator.style.top = '36px';
			indicator.style.right = '16px';

			const toolbar = document.getElementById('app-toolbar');
			const btn = toolbar.querySelector('#settings-btn');
			expect(rectsOverlap(btn, indicator)).toBe(true);
		});
	});

	for (const viewport of VIEWPORTS) {
		describe(viewport.label, () => {
			it('scenario 1: toolbar buttons do not overlap equipped dodge_roll key-item badge', () => {
				mountHudFixture(viewport);
				const toolbar = showInRunToolbar();
				const indicator = populateKeyItemDodgeRoll();
				const buttons = [...toolbar.querySelectorAll('button')].filter((btn) => isVisible(btn, window));

				assertNoPairwiseOverlap([...buttons, indicator], viewport.label);
				for (const btn of buttons) {
					expect(indicator.getBoundingClientRect().top).toBeGreaterThanOrEqual(btn.getBoundingClientRect().bottom);
				}
			});

			it('scenario 2: lock-on panel does not overlap comms log when both are visible', () => {
				mountHudFixture(viewport);
				populateKeyItemDodgeRoll();
				const lockOnPanel = populateLockOnPanel();
				const log = appendCommsLogLine(
					'Rewa',
					'Hold position — hostiles inbound on your vector.',
				);

				assertNoPairwiseOverlap([lockOnPanel, log], viewport.label);
				expect(lockOnPanel.getBoundingClientRect().bottom).toBeLessThanOrEqual(log.getBoundingClientRect().top);
			});

			it('scenario 3: quest comms toast does not overlap comms log line at level entry', async () => {
				vi.useFakeTimers();
				mountHudFixture(viewport);
				populateKeyItemDodgeRoll();
				try { localStorage.setItem('autogame_token', 'test-fake-jwt-token'); } catch (_) { /* ignore */ }

				await import('../main.js');
				window.__setKeyItemDefs({ dodge_roll: DODGE_ROLL_DEF });
				window.__setGameState(playingGameState(), 'p1');
				window.__syncQuestCommsPhaseForTest('playing');

				window.__showQuestDialogueForTest({
					speaker: 'Rewa',
					text: 'Radio check — sweep the annex and report when the sector is clear.',
				});

				const toast = document.querySelector('.quest-comms-toast');
				const log = document.getElementById('quest-comms-log');
				const line = log.querySelector('.quest-comms-line');

				expect(toast).not.toBeNull();
				expect(line).not.toBeNull();
				expect(toast.parentElement?.id).toBe('top-right-hud-stack');

				assertNoPairwiseOverlap([toast, log, line], viewport.label);
				expect(toast.getBoundingClientRect().bottom).toBeLessThanOrEqual(line.getBoundingClientRect().top);
			});

			it('full visible top-right HUD matrix has no pairwise overlaps', () => {
				mountHudFixture(viewport);
				const toolbar = showInRunToolbar();
				const indicator = populateKeyItemDodgeRoll();
				const lockOnPanel = populateLockOnPanel();
				const log = appendCommsLogLine('Rewa', 'Sector clear.');

				const toast = document.createElement('div');
				toast.className = 'quest-comms-toast';
				toast.innerHTML = '<strong>Rewa:</strong> Entry briefing.';
				const stack = document.getElementById('top-right-hud-stack');
				stack.insertBefore(toast, log);

				const buttons = [...toolbar.querySelectorAll('button')].filter((btn) => isVisible(btn, window));
				assertNoPairwiseOverlap(
					[...buttons, indicator, lockOnPanel, toast, log],
					`${viewport.label} full matrix`,
				);
			});
		});
	}

	it('keeps lock-on panel and comms log inside #top-right-hud-stack (DOM scaffold)', () => {
		const doc = new JSDOM(indexHtml).window.document;
		const stack = doc.getElementById('top-right-hud-stack');
		expect(stack?.querySelector('#key-item-indicator')).not.toBeNull();
		expect(stack?.querySelector('#lock-on-info-panel')).not.toBeNull();
		expect(stack?.querySelector('#quest-comms-log')).not.toBeNull();
	});

	it('does not use pre-fix absolute top anchors in style.css', () => {
		expect(styleCss).not.toMatch(/#key-item-indicator\s*\{[^}]*top:\s*36px/);
		expect(styleCss).not.toMatch(/#lock-on-info-panel\s*\{[^}]*top:\s*44px/);
		expect(styleCss).not.toMatch(/#quest-comms-log[^}]*top:\s*92px/);
		expect(styleCss).toContain('--top-right-hud-stack-top: 60px');
	});
});
