#!/usr/bin/env bash
set -euo pipefail

echo "==> Homebrew infrastructure"

# Redis
if ! brew list redis &>/dev/null; then
  brew install redis
fi
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
  brew services start redis
  sleep 2
fi
echo "Redis: $(redis-cli ping)"

# PostgreSQL 16
if ! brew list postgresql@16 &>/dev/null; then
  brew install postgresql@16
fi
if ! brew services list | grep postgresql@16 | grep -q started; then
  brew services start postgresql@16
  sleep 3
fi

# Create DB user/db if needed
PG_BIN="$(brew --prefix postgresql@16)/bin"
export PATH="$PG_BIN:$PATH"

if ! psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='registerkaro'" 2>/dev/null | grep -q 1; then
  createuser -s registerkaro 2>/dev/null || true
fi
if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='registerkaro'" 2>/dev/null | grep -q 1; then
  createdb -O registerkaro registerkaro 2>/dev/null || true
fi
# Set password for local dev
psql -d postgres -c "ALTER USER registerkaro WITH PASSWORD 'registerkaro';" 2>/dev/null || true
echo "PostgreSQL: registerkaro@localhost:5432/registerkaro"

# MinIO
MINIO_DATA="${HOME}/.registerkaro/minio-data"
mkdir -p "$MINIO_DATA"

if ! brew list minio/stable/minio &>/dev/null 2>&1; then
  brew install minio/stable/minio 2>/dev/null || brew install minio 2>/dev/null || true
fi

if ! curl -sf http://localhost:9000/minio/health/live &>/dev/null; then
  if ! pgrep -f 'minio server' &>/dev/null; then
    nohup minio server "$MINIO_DATA" --console-address ":9001" \
      > "${HOME}/.registerkaro/minio.log" 2>&1 &
    sleep 3
  fi
fi

# MinIO client for bucket creation
if ! command -v mc &>/dev/null; then
  brew install minio/stable/mc 2>/dev/null || true
fi
if command -v mc &>/dev/null; then
  mc alias set registerkaro-local http://localhost:9000 minioadmin minioadmin 2>/dev/null || true
  mc mb registerkaro-local/registerkaro-documents --ignore-existing 2>/dev/null || true
fi
echo "MinIO: http://localhost:9000 (console :9001)"
