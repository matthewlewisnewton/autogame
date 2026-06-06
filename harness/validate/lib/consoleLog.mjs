/**
 * Collect browser console/page errors for validation runs, filtering benign WebGL noise.
 */
import fs from 'fs';
import path from 'path';

const NOISE = /GL Driver Message|GPU stall|ReadPixels|fallback to software WebGL|Automatic fallback|CONTEXT_LOST_WEBGL|Context (Lost|Restored)|THREE\.WebGLRenderer|THREE\.Clock|deprecat/i;

/**
 * @param {import('playwright').Page} page
 * @returns {{ logs: string[], flush: () => string[] }}
 */
export function wireConsoleLog(page) {
	const logs = [];
	page.on('console', (msg) => {
		const text = msg.text();
		if (!NOISE.test(text)) {
			logs.push(`[console:${msg.type()}] ${text}`);
		}
	});
	page.on('pageerror', (err) => {
		logs.push(`[pageerror] ${err.message}`);
	});
	return {
		logs,
		flush: () => logs.splice(0, logs.length),
	};
}

/**
 * @param {string} outDirAbs
 * @param {string[]} entries
 */
export function writeConsoleLog(outDirAbs, entries) {
	if (!entries.length) return;
	fs.mkdirSync(outDirAbs, { recursive: true });
	const filePath = path.join(outDirAbs, 'console.log');
	const body = `${entries.join('\n')}\n`;
	fs.appendFileSync(filePath, body);
}
