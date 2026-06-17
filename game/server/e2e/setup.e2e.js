// Default the e2e service URLs to what scripts/e2e-services.sh provisions,
// unless the environment already provides them (CI may override host/ports).
// redis.js and PostgresProvider read these lazily, so setting them here — before
// any test body runs — is sufficient.
if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL = 'postgres://autogame:autogame@localhost:55432/autogame_e2e';
}
if (!process.env.REDIS_URL) {
	process.env.REDIS_URL = 'redis://localhost:56379';
}
process.env.PERSISTENCE_BACKEND = process.env.PERSISTENCE_BACKEND || 'postgres';
