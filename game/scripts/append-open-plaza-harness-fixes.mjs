#!/usr/bin/env node
/**
 * Append game/validation/open-plaza/harness-blocker-fixes.md to findings.md
 * after playthrough.mjs regenerates it (preserves ticket writable-output docs).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(GAME_ROOT, 'validation', 'open-plaza');
const FINDINGS_PATH = path.join(OUT_DIR, 'findings.md');
const FIXES_PATH = path.join(OUT_DIR, 'harness-blocker-fixes.md');
const SECTION_MARKER = '## Game fixes for harness blockers';
const FOLLOW_UPS = '## Follow-ups';

if (!fs.existsSync(FINDINGS_PATH)) {
	console.error('append-open-plaza-harness-fixes: missing findings.md');
	process.exit(1);
}
if (!fs.existsSync(FIXES_PATH)) {
	console.error('append-open-plaza-harness-fixes: missing harness-blocker-fixes.md');
	process.exit(1);
}

const fixes = fs.readFileSync(FIXES_PATH, 'utf8').trimEnd();
let findings = fs.readFileSync(FINDINGS_PATH, 'utf8');

if (findings.includes(SECTION_MARKER)) {
	const sectionRe = new RegExp(
		`\\n${SECTION_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n${FOLLOW_UPS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
	);
	findings = findings.replace(sectionRe, '');
}

if (!findings.includes(FOLLOW_UPS)) {
	findings = `${findings.trimEnd()}\n\n${fixes}\n`;
} else {
	findings = findings.replace(FOLLOW_UPS, `${fixes}\n\n${FOLLOW_UPS}`);
}

fs.writeFileSync(FINDINGS_PATH, findings.endsWith('\n') ? findings : `${findings}\n`);
