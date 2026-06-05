// Admin roster data layer — aggregates every account/character into a single
// read-only array for the /admin view to render. Performs no HTTP work.

const { getAllUsers } = require('./users');
const { getProvider } = require('./progression');

/**
 * Build a read-only roster combining account records with each account's
 * persisted character data. One entry per account.
 *
 * Account fields (username, cosmetic, unlocked hats, quest-tier unlocks) come
 * from the in-memory user store; currency / deck / owned cards are read from
 * the persisted character record via `getProvider().loadPlayer(accountId)`.
 * A missing record or a load failure degrades to safe defaults rather than
 * throwing. User records and persisted data are never mutated, and
 * `passwordHash` is never included (getAllUsers already strips it).
 *
 * @returns {Array<object>}
 */
function buildAdminRoster() {
	const users = getAllUsers();
	const provider = getProvider();

	return users.map((user) => {
		const cosmetic = user.cosmetic || {};

		let persisted = null;
		if (provider && typeof provider.loadPlayer === 'function') {
			try {
				persisted = provider.loadPlayer(user.accountId);
			} catch (_err) {
				// A load failure degrades to defaults rather than throwing.
				persisted = null;
			}
		}
		persisted = persisted || {};

		return {
			accountId: user.accountId,
			username: user.username,
			cosmetic,
			equippedHat: cosmetic.hat,
			unlockedHats: Array.isArray(user.unlockedHats) ? user.unlockedHats : [],
			unlockedQuestTiers: user.unlockedQuestTiers || {},
			currency: typeof persisted.currency === 'number' ? persisted.currency : 0,
			selectedDeck: Array.isArray(persisted.selectedDeck) ? persisted.selectedDeck : [],
			ownedCards: persisted.ownedCards || {}
		};
	});
}

module.exports = { buildAdminRoster };
