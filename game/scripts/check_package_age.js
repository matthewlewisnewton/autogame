#!/usr/bin/env node
'use strict';

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse --min-age-days from argv. Returns the parsed integer or the default.
 */
function parseMinAgeDays(defaultDays) {
  const flag = '--min-age-days';
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const val = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return defaultDays;
}

/**
 * Recursively walk the pnpm ls --json tree and collect unique name@version entries.
 * The tree is nested: top-level has devDependencies/dependencies, each of which
 * may have a "dependencies" map with further nesting.
 */
function collectPackages(node, seen) {
  if (!node) return;

  const deps = node.dependencies || node.devDependencies || node.optionalDependencies;
  // pnpm ls --json returns top-level keys: devDependencies, dependencies, optionalDependencies
  // For nested entries the key is always "dependencies".
  const depMaps = [];
  if (node.devDependencies) depMaps.push(node.devDependencies);
  if (node.dependencies) depMaps.push(node.dependencies);
  if (node.optionalDependencies) depMaps.push(node.optionalDependencies);

  for (const depMap of depMaps) {
    if (!depMap || typeof depMap !== 'object') continue;
    for (const [name, info] of Object.entries(depMap)) {
      const version = info && info.version;
      if (version) {
        const key = `${name}@${version}`;
        if (!seen.has(key)) {
          seen.add(key);
        }
      }
      // Recurse into nested dependencies
      if (info && info.dependencies) {
        collectPackages({ dependencies: info.dependencies }, seen);
      }
    }
  }
}

/**
 * Run `pnpm ls --json --depth Infinity` in the given directory and return parsed JSON.
 */
function getPnpmPackages(projectDir) {
  try {
    const raw = execSync('pnpm ls --json --depth Infinity', {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(raw);
    // pnpm may return an array (monorepo workspaces) or a single object
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const seen = new Set();
    for (const entry of list) {
      collectPackages(entry, seen);
    }
    return seen;
  } catch (err) {
    console.error(`Error running pnpm ls: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Fetch JSON from a URL using the built-in https module. Returns a Promise.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one level of redirect
        https.get(res.headers.location, (res2) => {
          let data2 = '';
          res2.on('data', (chunk) => { data2 += chunk; });
          res2.on('end', () => {
            try { resolve(JSON.parse(data2)); }
            catch (e) { reject(new Error(`Invalid JSON from redirect: ${e.message}`)); }
          });
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

/**
 * Get the publish timestamp (ms) for a specific version of a package.
 * Returns epoch ms or null if not found.
 */
async function getVersionPublishTime(name, version) {
  const url = `https://registry.npmjs.org/${name}`;
  let data;
  try {
    data = await fetchJson(url);
  } catch (err) {
    console.warn(`  WARN: could not fetch ${name} from registry (${err.message})`);
    return null;
  }

  if (!data || !data.time) return null;

  // time object maps version strings to ISO date strings
  const versionTime = data.time[version];
  if (versionTime) {
    return new Date(versionTime).getTime();
  }

  // Fallback to time.created
  const createdTime = data.time.created;
  if (createdTime) {
    return new Date(createdTime).getTime();
  }

  return null;
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const DEFAULT_MIN_AGE_DAYS = 7;
  const minAgeDays = parseMinAgeDays(DEFAULT_MIN_AGE_DAYS);
  const cutoff = Date.now() - minAgeDays * 86400000;

  const projectDir = path.resolve(__dirname, '..');

  console.log(`Checking package ages (min ${minAgeDays} days, cutoff: ${new Date(cutoff).toISOString()})`);

  const packages = getPnpmPackages(projectDir);
  console.log(`Found ${packages.size} unique packages\n`);

  const flagged = [];
  const skipped = [];

  const pkgArray = Array.from(packages);
  for (let i = 0; i < pkgArray.length; i++) {
    const entry = pkgArray[i];
    // Split on the last '@' to handle scoped packages (@scope/name@version)
    const lastAt = entry.lastIndexOf('@');
    const name = entry.slice(0, lastAt);
    const version = entry.slice(lastAt + 1);

    // Progress indicator every 25 packages
    if (i % 25 === 0) {
      process.stdout.write(`  [${i}/${pkgArray.length}] `);
    }

    const publishTime = await getVersionPublishTime(name, version);

    if (publishTime === null) {
      skipped.push(entry);
    } else if (publishTime > cutoff) {
      // Published after the cutoff — too new
      flagged.push({ name, version, publishDate: new Date(publishTime).toISOString() });
    }

    // Rate-limit: 100ms between requests (skip after last)
    if (i < pkgArray.length - 1) {
      await sleep(100);
    }
  }
  process.stdout.write('\n');

  // Summary
  console.log('---');
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} package(s) (network/parse error): ${skipped.join(', ')}`);
  }

  if (flagged.length > 0) {
    console.log(`\nFAIL: ${flagged.length} package(s) published within the last ${minAgeDays} days:\n`);
    for (const p of flagged) {
      console.log(`  ${p.name}@${p.version}  —  published ${p.publishDate}`);
    }
    process.exit(1);
  } else {
    console.log(`\nOK — all ${pkgArray.length - flagged.length - skipped.length}/${pkgArray.length} checked packages are >= ${minAgeDays} days old.`);
    process.exit(0);
  }
}

main();
