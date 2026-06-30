#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${TARGET_DIR:-/opt/sub2api-deploy}"
FORCE=0
SKIP_DEPS=0
SKIP_CADDY=0
REQUIRE_PUBLIC=0

usage() {
  cat <<'USAGE'
Usage: sudo bash install-vps.sh [options]

Options:
  --target-dir PATH      Install directory, default /opt/sub2api-deploy
  --force                Replace an existing Sub2API deployment directory
  --skip-deps            Do not install Docker/Caddy packages
  --skip-caddy           Do not install or reload Caddy
  --require-public       Fail if public HTTPS /health does not pass
  -h, --help             Show this help

The migration package is plaintext and contains production secrets.
Keep it outside any public web directory and remove it after verification.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="${2:?--target-dir requires a path}"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --skip-deps)
      SKIP_DEPS=1
      shift
      ;;
    --skip-caddy)
      SKIP_CADDY=1
      shift
      ;;
    --require-public)
      REQUIRE_PUBLIC=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_file() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    echo "Required file missing: $path" >&2
    exit 1
  fi
}

need_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Please run with sudo/root: sudo bash install-vps.sh --force" >&2
    exit 1
  fi
}

load_env_value() {
  local key="$1"
  local file="${2:-.env}"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2-
}

verify_package_checksums() {
  if [[ ! -f "$SCRIPT_DIR/SHA256SUMS" ]]; then
    echo "Warning: SHA256SUMS is missing; skip package integrity check." >&2
    return
  fi

  (
    cd "$SCRIPT_DIR"
    sha256sum -c SHA256SUMS
  )
}

install_dependencies() {
  if [[ "$SKIP_DEPS" -eq 1 ]]; then
    return
  fi

  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    if [[ "${ID:-}" != "ubuntu" ]]; then
      echo "Warning: this installer is tested for Ubuntu 22.04/24.04, detected ${PRETTY_NAME:-unknown}." >&2
    fi
  fi

  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release unzip jq

  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 plugin is required but was not found after Docker installation." >&2
    exit 1
  fi

  if [[ "$SKIP_CADDY" -eq 0 ]] && ! command -v caddy >/dev/null 2>&1; then
    apt-get install -y caddy
  fi
}

wait_for_postgres() {
  local postgres_user="$1"
  local postgres_db="$2"
  for _ in $(seq 1 60); do
    if docker compose --env-file .env -f docker-compose.production.yml exec -T postgres \
      pg_isready -U "$postgres_user" -d "$postgres_db" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "PostgreSQL did not become healthy in time." >&2
  return 1
}

wait_for_http() {
  local url="$1"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "HTTP health check timed out: $url" >&2
  return 1
}

compare_table_counts() {
  if [[ ! -f manifest.json ]]; then
    return
  fi
  if ! jq -e '.table_counts' manifest.json >/dev/null 2>&1; then
    return
  fi

  local postgres_user="$1"
  local postgres_db="$2"
  local mismatch=0
  while IFS=$'\t' read -r table expected; do
    [[ -z "$table" || "$expected" == "null" ]] && continue
    local actual
    actual="$(docker compose --env-file .env -f docker-compose.production.yml exec -T postgres \
      psql -U "$postgres_user" -d "$postgres_db" -t -A \
      -c "select count(*) from \"$table\";" | tr -d '\r[:space:]')"
    if [[ "$actual" != "$expected" ]]; then
      echo "Table count mismatch: $table expected=$expected actual=$actual" >&2
      mismatch=1
    else
      echo "Table count ok: $table=$actual"
    fi
  done < <(jq -r '.table_counts | to_entries[] | [.key, (.value|tostring)] | @tsv' manifest.json)

  if [[ "$mismatch" -ne 0 ]]; then
    echo "One or more table counts differ. Inspect the restore before switching DNS." >&2
    return 1
  fi
}

need_root
require_file "$SCRIPT_DIR/.env"
require_file "$SCRIPT_DIR/docker-compose.production.yml"
require_file "$SCRIPT_DIR/postgres.dump"
require_file "$SCRIPT_DIR/Caddyfile"

verify_package_checksums
install_dependencies

if [[ -d "$TARGET_DIR" ]] && [[ "$FORCE" -ne 1 ]]; then
  echo "Target directory already exists: $TARGET_DIR" >&2
  echo "Re-run with --force after confirming backups/rollback are ready." >&2
  exit 1
fi

if [[ -d "$TARGET_DIR" ]] && [[ "$FORCE" -eq 1 ]]; then
  if [[ -f "$TARGET_DIR/docker-compose.production.yml" ]]; then
    (cd "$TARGET_DIR" && docker compose --env-file .env -f docker-compose.production.yml down || true)
  fi
  rm -rf "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR"
cp -a "$SCRIPT_DIR/.env" "$TARGET_DIR/.env"
cp -a "$SCRIPT_DIR/docker-compose.production.yml" "$TARGET_DIR/docker-compose.production.yml"
cp -a "$SCRIPT_DIR/postgres.dump" "$TARGET_DIR/postgres.dump"
cp -a "$SCRIPT_DIR/manifest.json" "$TARGET_DIR/manifest.json" 2>/dev/null || true
cp -a "$SCRIPT_DIR/SHA256SUMS" "$TARGET_DIR/SHA256SUMS" 2>/dev/null || true
if [[ -d "$SCRIPT_DIR/data" ]]; then
  cp -a "$SCRIPT_DIR/data" "$TARGET_DIR/data"
else
  mkdir -p "$TARGET_DIR/data"
fi
mkdir -p "$TARGET_DIR/postgres_data" "$TARGET_DIR/redis_data" "$TARGET_DIR/backups"
chmod 600 "$TARGET_DIR/.env"

cd "$TARGET_DIR"

POSTGRES_USER="$(load_env_value POSTGRES_USER .env)"
POSTGRES_DB="$(load_env_value POSTGRES_DB .env)"
SERVER_PORT="$(load_env_value SERVER_PORT .env)"
SERVER_FRONTEND_URL="$(load_env_value SERVER_FRONTEND_URL .env)"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-sub2api}"
SERVER_PORT="${SERVER_PORT:-8080}"

docker compose --env-file .env -f docker-compose.production.yml pull
docker compose --env-file .env -f docker-compose.production.yml up -d postgres redis
wait_for_postgres "$POSTGRES_USER" "$POSTGRES_DB"

docker compose --env-file .env -f docker-compose.production.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges --exit-on-error < postgres.dump

compare_table_counts "$POSTGRES_USER" "$POSTGRES_DB"

docker compose --env-file .env -f docker-compose.production.yml up -d sub2api
wait_for_http "http://127.0.0.1:${SERVER_PORT}/health"

settings_json="$(curl -fsS "http://127.0.0.1:${SERVER_PORT}/api/v1/settings/public")"
if ! printf '%s' "$settings_json" | jq -e '.code == 0' >/dev/null; then
  echo "Local public settings check failed: $settings_json" >&2
  exit 1
fi

if [[ "$SKIP_CADDY" -eq 0 ]]; then
  cp -a "$SCRIPT_DIR/Caddyfile" /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile
  systemctl enable --now caddy
  systemctl reload caddy
fi

if [[ -n "$SERVER_FRONTEND_URL" ]]; then
  if curl -fsS "${SERVER_FRONTEND_URL%/}/health" >/dev/null 2>&1; then
    echo "Public HTTPS health check passed: ${SERVER_FRONTEND_URL%/}/health"
  else
    echo "Public HTTPS health check did not pass yet: ${SERVER_FRONTEND_URL%/}/health" >&2
    echo "This is expected before DNS points to this VPS or before certificates are issued." >&2
    if [[ "$REQUIRE_PUBLIC" -eq 1 ]]; then
      exit 1
    fi
  fi
fi

echo "Sub2API migration restore completed at $TARGET_DIR"
echo "Next: point DNS to this VPS, then run: curl -fsS ${SERVER_FRONTEND_URL%/}/health"
