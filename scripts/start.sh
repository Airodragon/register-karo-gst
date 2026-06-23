#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

echo "==> Starting Docker infrastructure..."
docker compose -f "$ROOT/infra/docker-compose.yml" up -d

echo "==> Waiting for Postgres, Redis, MinIO..."
for i in {1..30}; do
  redis-cli ping 2>/dev/null | grep -q PONG && break
  sleep 1
done

for i in {1..30}; do
  curl -sf http://localhost:9000/minio/health/live &>/dev/null && break
  sleep 1
done

echo "==> Infrastructure ready. Starting API, Web, Worker..."
cd "$ROOT"
bash "$ROOT/scripts/free-ports.sh"
exec pnpm dev:all
