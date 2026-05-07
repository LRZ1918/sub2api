#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:8080/health}"
PUBLIC_URL="${PUBLIC_URL:-}"

cd "$DEPLOY_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-sub2api}" -d "${POSTGRES_DB:-sub2api}"
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping
curl -fsS "$LOCAL_URL"
echo

if [ -n "$PUBLIC_URL" ]; then
  curl -fsS "$PUBLIC_URL"
  echo
fi
