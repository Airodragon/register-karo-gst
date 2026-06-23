#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> RegisterKaro setup"

# --- .env ---
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if grep -q 'change-me-in-production' .env 2>/dev/null; then
  JWT_SECRET=$(openssl rand -hex 32)
  ENC_KEY=$(openssl rand -hex 16)
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i '' "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENC_KEY}/" .env
  else
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENC_KEY}/" .env
  fi
  echo "Generated JWT_SECRET and ENCRYPTION_KEY in .env"
fi

# --- Dependencies ---
echo "==> Installing Node dependencies"
corepack enable 2>/dev/null || true
pnpm install

echo "==> Building shared packages"
pnpm --filter @registerkaro/shared-types build
pnpm --filter @registerkaro/gst-form-schema build

# --- Infrastructure: Docker preferred ---
if command -v docker &>/dev/null; then
  echo "==> Starting Docker services (Postgres, Redis, MinIO)"
  docker compose -f infra/docker-compose.yml up -d
  echo "Waiting for services..."
  sleep 8
else
  echo "==> Docker not found — using Homebrew services"
  "$ROOT/scripts/infra-brew.sh"
fi

# --- Wait for Postgres ---
echo "==> Waiting for PostgreSQL"
for i in {1..30}; do
  if (echo >/dev/tcp/localhost/5432) 2>/dev/null; then
    break
  fi
  sleep 1
done

# --- Wait for Redis ---
echo "==> Waiting for Redis"
for i in {1..30}; do
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  sleep 1
done

# --- MinIO bucket (brew path) ---
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q registerkaro-minio; then
  if command -v mc &>/dev/null; then
    mc alias set registerkaro-local http://localhost:9000 minioadmin minioadmin 2>/dev/null || true
    mc mb registerkaro-local/registerkaro-documents --ignore-existing 2>/dev/null || true
  fi
fi

# --- Database ---
echo "==> Prisma generate & push"
cd apps/api
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
cd "$ROOT"

# --- Playwright ---
echo "==> Installing Playwright Chromium"
pnpm --filter @registerkaro/gst-automation exec playwright install chromium

echo ""
echo "Setup complete!"
echo ""
echo "  Start dev:  pnpm dev:all"
echo "  Or separately:"
echo "    pnpm dev:api"
echo "    pnpm dev:web"
echo "    pnpm dev:worker"
echo ""
echo "  Login: admin@registerkaro.local / admin123"
echo "  Web:   http://localhost:3000"
echo "  API:   http://localhost:3001"
echo "  MinIO: http://localhost:9001 (minioadmin / minioadmin)"
