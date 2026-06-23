# RegisterKaro — Local infrastructure

Configured via **Docker Compose** (`pnpm docker:up`).

## Service status

| Service | URL / connection | Credentials |
|---------|------------------|-------------|
| **PostgreSQL** | `localhost:5432` / DB `registerkaro` | user: `registerkaro` / pass: `registerkaro` |
| **Redis** | `redis://localhost:6379` | no password |
| **MinIO (S3)** | API: `http://localhost:9000` | access: `minioadmin` / secret: `minioadmin` |
| **MinIO Console** | `http://localhost:9001` | same as above |
| **S3 bucket** | `registerkaro-documents` | auto-created on `docker compose up` |
| **API** | `http://localhost:3001` | see login below |
| **Web UI** | `http://localhost:3000` | ops dashboard |
| **Worker** | background process | token: `worker-dev-token` |

## Docker commands

```bash
pnpm docker:up      # start Postgres, Redis, MinIO
pnpm docker:down    # stop containers
docker compose -f infra/docker-compose.yml ps   # status
```

If `docker compose` fails with `docker-credential-osxkeychain` not found, add Docker to PATH:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
```

Add that line to `~/.zshrc` to make it permanent.

## Fallback: Homebrew (no Docker)

```bash
bash scripts/infra-brew.sh
```

## App login (seeded)

- **Email:** `admin@registerkaro.local`
- **Password:** `admin123`

## Environment file

All config is in [`.env`](../.env) at the repo root. Symlinked into:

- `apps/api/.env`
- `workers/gst-automation/.env`

## Start / stop infrastructure

```bash
pnpm docker:up      # start
pnpm docker:down    # stop
```

## Start the application

```bash
pnpm dev:all          # API + Web + Worker together
# or separately:
pnpm dev:api
pnpm dev:web
pnpm dev:worker
```

## One-time setup (new machine)

```bash
pnpm setup
```

## What each service does

- **PostgreSQL** — applications, users, audit log, TRN/ARN state
- **Redis** — BullMQ job queue + OTP input pub/sub between UI and worker
- **MinIO** — document uploads (PAN, photos, address proof)
- **Worker** — Playwright automation against gst.gov.in

## Production note

For production, replace MinIO with AWS S3, use managed Postgres/Redis, and set strong `JWT_SECRET` / `WORKER_TOKEN`.
