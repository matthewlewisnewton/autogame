const { ENEMY_DEFS } = require('./simulation');
const { VARIANT_DEFS } = require('./enemyVariants');

/** Copy display metadata plus values for each surfaced stat key (omit other combat tuning). */
function trimDisplayEntry(def) {
  const entry = {
    name: def.name,
    description: def.description,
    surfacedStats: [...def.surfacedStats],
  };
  for (const key of def.surfacedStats) {
    if (Object.prototype.hasOwnProperty.call(def, key)) {
      entry[key] = def[key];
    }
  }
  return entry;
}

function buildEnemyDisplayCatalog() {
  const types = {};
  for (const id of Object.keys(ENEMY_DEFS)) {
    types[id] = trimDisplayEntry(ENEMY_DEFS[id]);
  }
  const variants = {};
  for (const id of Object.keys(VARIANT_DEFS)) {
    variants[id] = trimDisplayEntry(VARIANT_DEFS[id]);
  }
  return { types, variants };
}

module.exports = { buildEnemyDisplayCatalog };
