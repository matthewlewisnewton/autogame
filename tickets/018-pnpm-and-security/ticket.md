# Package Manager Migration and Security

Transition the repository from `npm` to `pnpm` to improve installation speed and disk space efficiency, and implement a security check for package age.

## Acceptance Criteria
- All `package-lock.json` files are removed and replaced with `pnpm-lock.yaml`.
- All `npm install` and `npm run` commands in documentation, context, and scripts are updated to use `pnpm`.
- A script or GitHub Action is added to enforce a minimum package version age (e.g., rejecting any dependency updates published less than 7 days ago) to prevent supply chain attacks.
- The game client and server start up correctly after the migration.

## Technical Specs
- **Files to modify**: `game/package.json`, `game/client/package.json`, `game/server/package.json`, `CONTEXT.md`, and any harness scripts referencing `npm`.
- **Package Manager**: Use `pnpm import` if you want to keep lockfile resolutions, or just `pnpm install` everywhere to regenerate.
- **Security Script**: Create a script (e.g., `scripts/check_package_age.js`) that uses the npm registry API (`https://registry.npmjs.org/<pkg>`) to check the `time` field of installed dependencies and fails the CI/build if any are too new.
