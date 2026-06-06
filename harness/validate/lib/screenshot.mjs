/**
 * Write named PNG screenshots into a validation output directory.
 */
import fs from 'fs';
import path from 'path';

function safeName(value, fallback) {
	const s = String(value || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
	return s || fallback;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} outDir - absolute output directory
 * @param {string} name - filename without path (`.png` appended if missing)
 * @returns {Promise<string>} absolute path written
 */
export async function writeScreenshot(page, outDir, name) {
	fs.mkdirSync(outDir, { recursive: true });
	const base = safeName(name, 'screenshot');
	const file = base.endsWith('.png') ? base : `${base}.png`;
	const filePath = path.join(outDir, file);
	await page.screenshot({ path: filePath, fullPage: false });
	return filePath;
}
