#!/usr/bin/env bash
#
# Spin up REAL Postgres + Redis for end-to-end tests — the same script is used
# locally and in CI (it only needs `docker`, no compose/buildx). Idempotent:
# `up` is safe to call when containers already run. The e2e suite defaults to the
# DATABASE_URL / REDIS_URL printed below (see server/e2e/setup.e2e.js).
#
#   bash scripts/e2e-services.sh up     # start + wait for ready, print URLs
#   bash scripts/e2e-services.sh down   # remove containers
#   bash scripts/e2e-services.sh env    # print the connection URLs
set -euo pipefail

PG_CONTAINER="${E2E_PG_CONTAINER:-autogame-e2e-postgres}"
REDIS_CONTAINER="${E2E_REDIS_CONTAINER:-autogame-e2e-redis}"
PG_PORT="${E2E_PG_PORT:-55432}"
REDIS_PORT="${E2E_REDIS_PORT:-56379}"
PG_USER=autogame
PG_PASSWORD=autogame
PG_DB=autogame_e2e

DATABASE_URL="postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"
REDIS_URL="redis://localhost:${REDIS_PORT}"

wait_ready() {
  local n=0
  until docker exec "${PG_CONTAINER}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; do
    n=$((n + 1)); [ "$n" -ge 60 ] && { echo "postgres not ready after 60s" >&2; exit 1; }; sleep 1
  done
  n=0
  until [ "$(docker exec "${REDIS_CONTAINER}" redis-cli ping 2>/dev/null)" = "PONG" ]; do
    n=$((n + 1)); [ "$n" -ge 30 ] && { echo "redis not ready after 30s" >&2; exit 1; }; sleep 1
  done
}

up() {
  if ! docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER}"; then
    docker rm -f "${PG_CONTAINER}" >/dev/null 2>&1 || true
    docker run -d --name "${PG_CONTAINER}" \
      -e POSTGRES_USER="${PG_USER}" -e POSTGRES_PASSWORD="${PG_PASSWORD}" -e POSTGRES_DB="${PG_DB}" \
      -p "${PG_PORT}:5432" postgres:16-alpine >/dev/null
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "${REDIS_CONTAINER}"; then
    docker rm -f "${REDIS_CONTAINER}" >/dev/null 2>&1 || true
    docker run -d --name "${REDIS_CONTAINER}" -p "${REDIS_PORT}:6379" redis:7-alpine >/dev/null
  fi
  wait_ready
  echo "DATABASE_URL=${DATABASE_URL}"
  echo "REDIS_URL=${REDIS_URL}"
}

down() {
  docker rm -f "${PG_CONTAINER}" "${REDIS_CONTAINER}" >/dev/null 2>&1 || true
  echo "stopped ${PG_CONTAINER} + ${REDIS_CONTAINER}"
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  wait) wait_ready ;;
  env) echo "DATABASE_URL=${DATABASE_URL}"; echo "REDIS_URL=${REDIS_URL}" ;;
  *) echo "usage: $0 {up|down|wait|env}" >&2; exit 1 ;;
esac
