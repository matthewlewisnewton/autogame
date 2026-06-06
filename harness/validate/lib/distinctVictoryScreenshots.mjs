import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Reject validation artifacts when boss-defeated and victory PNGs are identical.
 *
 * @param {string} dirAbs - Directory containing 06-boss-defeated.png and 07-victory.png
 * @param {string[]} errors - Accumulator for verifier error messages
 * @param {string} [relPrefix] - Path prefix for error messages (e.g. "game/validation/rooms/")
 */
export function assertDistinctVictoryScreenshots(dirAbs, errors, relPrefix = '') {
	const bossPath = path.join(dirAbs, '06-boss-defeated.png');
	const victoryPath = path.join(dirAbs, '07-victory.png');
	if (!fs.existsSync(bossPath) || !fs.existsSync(victoryPath)) {
		return;
	}

	const bossMd5 = crypto.createHash('md5').update(fs.readFileSync(bossPath)).digest('hex');
	const victoryMd5 = crypto.createHash('md5').update(fs.readFileSync(victoryPath)).digest('hex');
	if (bossMd5 === victoryMd5) {
		errors.push(
			`${relPrefix}06-boss-defeated.png and 07-victory.png are byte-identical (md5 ${bossMd5}); `
			+ '07-victory must capture the Sortie Complete overlay after 06-boss-defeated',
		);
	}
}
