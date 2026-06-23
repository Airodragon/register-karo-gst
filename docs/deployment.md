# Production deployment (VPS + Docker)

Deploy the full RegisterKaro stack on a single VPS with Docker Compose and Caddy as the reverse proxy.

## Requirements

- Ubuntu 22.04+ (or similar Linux VPS)
- **2 vCPU / 4 GB RAM** minimum (Playwright worker is memory-heavy)
- A domain pointed at the VPS (for HTTPS via Caddy), or use `localhost` for IP-only testing
- Docker Engine 24+ and Docker Compose v2

## 1. Provision the server

```bash
# Install Docker (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in so docker group applies
```

Open firewall ports **80** and **443** only. Postgres, Redis, and MinIO stay on the internal Docker network.

## 2. Clone and configure

```bash
git clone https://github.com/Airodragon/register-karo-gst.git
cd register-karo-gst
cp .env.production.example .env
```

Edit `.env`:

| Variable | Notes |
|----------|--------|
| `DOMAIN` | Your public hostname, e.g. `gst-demo.example.com` |
| `NEXT_PUBLIC_API_URL` | `https://your-domain.com` (must match public URL) |
| `CORS_ORIGIN` | Same as `NEXT_PUBLIC_API_URL` |
| `POSTGRES_PASSWORD` | Strong password; keep in sync with `DATABASE_URL` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 16` |
| `WORKER_TOKEN` | `openssl rand -hex 24` |
| `S3_SECRET_KEY` | Strong MinIO secret |
| `HEADLESS` | Keep `true` on VPS (no display for Chromium) |

## 3. Build and start

From the repo root:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env build
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d
```

Check status:

```bash
docker compose -f infra/docker-compose.prod.yml ps
docker compose -f infra/docker-compose.prod.yml logs -f api worker
```

## 4. Seed admin user (first deploy only)

```bash
docker compose -f infra/docker-compose.prod.yml exec api \
  sh -c "cd /app/apps/api && npx ts-node prisma/seed.ts"
```

Default login (change after first login in production):

- Email: `admin@registerkaro.local`
- Password: `admin123`

## 5. Access the app

- **App:** `https://your-domain.com`
- **API health:** `https://your-domain.com/api/health` (if health route exists)

Caddy terminates TLS automatically when `DOMAIN` is a real hostname. For local/IP testing, set `DOMAIN=localhost` in `.env`.

## Architecture

```
Internet → Caddy (:80/:443)
            ├── /api/*, /socket.io/* → NestJS API (:3001)
            └── /*                   → Next.js Web (:3000)

API  → Postgres, Redis, MinIO
Worker → Redis, API, gst.gov.in (Playwright)
```

## Test mode (local dev)

On a machine with a display, operators can run automation with a visible browser:

1. Open DevTools console on the dashboard
2. Run `window.__test__ = true`
3. Start automation — the worker receives `headless: false`

On a headless VPS this flag does not show a window to the operator; use it for local development only.

## Updates

```bash
git pull
docker compose -f infra/docker-compose.prod.yml --env-file .env build
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d
```

## Alternatives

| Platform | What fits |
|----------|-----------|
| **Vercel** | Next.js web only; API/worker must run elsewhere |
| **Railway / Render** | API + worker as separate services + managed Postgres/Redis |
| **AWS** | ECS/Fargate for API/worker, RDS, ElastiCache, S3 |

This VPS setup is the simplest way to get one URL for the full assignment demo.

## Troubleshooting

- **Worker OOM:** Increase VPS RAM or set `WORKER_CONCURRENCY=1`
- **Playwright crashes:** Ensure `shm_size: 1gb` on worker (already in compose file)
- **WebSocket errors:** Confirm Caddy routes `/socket.io/*` to the API and `NEXT_PUBLIC_API_URL` matches the browser origin
- **CORS errors:** `CORS_ORIGIN` must exactly match the URL users open in the browser
