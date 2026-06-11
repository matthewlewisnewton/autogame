import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Reject validation artifacts when boss-defeated and victory PNGs are identical.
 *
 * @param {string} dirAbs - Directory containing boss-defeated and victory PNGs
 * @param {string[]} errors - Accumulator for verifier error messages
 * @param {string} [relPrefix] - Path prefix for error messages (e.g. "game/validation/rooms/")
 * @param {{ bossDefeatedName?: string, victoryName?: string }} [opts]
 */
export function assertDistinctVictoryScreenshots(
	dirAbs,
	errors,
	relPrefix = '',
	{
		bossDefeatedName = '06-boss-defeated.png',
		victoryName = '07-victory.png',
	} = {},
) {
	const bossPath = path.join(dirAbs, bossDefeatedName);
	const victoryPath = path.join(dirAbs, victoryName);
	if (!fs.existsSync(bossPath) || !fs.existsSync(victoryPath)) {
		return;
	}

	const bossMd5 = crypto.createHash('md5').update(fs.readFileSync(bossPath)).digest('hex');
	const victoryMd5 = crypto.createHash('md5').update(fs.readFileSync(victoryPath)).digest('hex');
	if (bossMd5 === victoryMd5) {
		errors.push(
			`${relPrefix}${bossDefeatedName} and ${victoryName} are byte-identical (md5 ${bossMd5}); `
			+ `${victoryName} must capture the Sortie Complete overlay after ${bossDefeatedName}`,
		);
	}
}
