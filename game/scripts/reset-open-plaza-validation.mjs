#!/usr/bin/env node
/**
 * Remove the append-only logs under game/validation/open-plaza/ before
 * playthrough.mjs regenerates the artifacts.
 *
 * Both console.log (lib/consoleLog.mjs writeConsoleLog → appendFileSync) and
 * server.log (lib/gameProcess.mjs createWriteStream { flags: 'a' }) are opened
 * in append mode, so without this reset they accumulate entries across runs.
 * That left findings.md (regenerated each run from the CURRENT run's console
 * entries) inconsistent with a console.log still carrying stale entries from
 * earlier, pre-fix runs (e.g. a now-removed `/models/arena-champion.glb` load
 * warning and transient boot-time 502s). Truncating here guarantees the fresh
 * console.log reflects only the current run, so it stays consistent with
 * findings.md. Run-summary/probes/findings/screenshots are written with
 * writeFileSync and overwrite cleanly, so only the append-mode logs need this.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(GAME_ROOT, 'validation', 'open-plaza');
const APPEND_ONLY_LOGS = ['console.log', 'server.log'];

for (const name of APPEND_ONLY_LOGS) {
	fs.rmSync(path.join(OUT_DIR, name), { force: true });
}
