#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$DEPLOY_DIR"
mkdir -p "$BACKUP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${BACKUP_DIR}/sub2api-backup-${timestamp}.tar.gz"
tmp_dir="$(mktemp -d "${BACKUP_DIR}/sub2api-backup-${timestamp}.XXXXXX")"
db_dump="${tmp_dir}/postgres.sql"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "compose file not found: ${DEPLOY_DIR}/${COMPOSE_FILE}" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-sub2api}" "${POSTGRES_DB:-sub2api}" > "$db_dump"

tar --warning=no-file-changed -czf "$backup_file" \
  .env \
  data \
  postgres_data \
  redis_data \
  -C "$tmp_dir" \
  postgres.sql
find "$BACKUP_DIR" -type f -name 'sub2api-backup-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "$backup_file"
