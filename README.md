# RegisterKaro

Production-grade internal ops platform for automating GST REG-01 registration on [gst.gov.in](https://www.gst.gov.in/) through ARN generation.

## Stack

- **Web**: Next.js 15, Tailwind CSS
- **API**: NestJS, Prisma, PostgreSQL
- **Queue**: Redis + BullMQ
- **Automation**: Playwright worker
- **Storage**: MinIO (S3-compatible)

## Quick start

### Option A — automated setup (recommended)

```bash
cp .env.example .env
pnpm setup          # installs deps, starts infra, migrates DB, seeds admin, Playwright
pnpm dev:all        # API + Web + Worker
```

### Option B — manual steps

```bash
cp .env.example .env
pnpm docker:up      # or: bash scripts/infra-brew.sh (no Docker)
pnpm install
pnpm --filter @registerkaro/api db:push
pnpm --filter @registerkaro/api db:seed
pnpm --filter @registerkaro/gst-automation exec playwright install chromium
pnpm dev:all
```

**Full connection details:** [docs/infrastructure.md](docs/infrastructure.md)

### Run everything (one command)

```bash
pnpm start          # same as pnpm docker:all
```

This starts Docker (Postgres, Redis, MinIO) then API + Web + Worker.

### Run in two steps

```bash
pnpm docker:up      # infrastructure only
pnpm dev:all        # API + Web + Worker
```

- URL: http://localhost:3000/login
- Email: `admin@registerkaro.local`
- Password: `admin123`

## Workflow

1. Create a new filing from the dashboard
2. Fill client details in the wizard and save
3. Click **Start Part A** — enter captcha/OTP when prompted
4. TRN is captured automatically (valid 15 days)
5. Click **Continue automation** for Part B fill + EVC submit
6. Complete Aadhaar OTP when prompted
7. ARN appears on the application card when generated

## Project structure

```
apps/web          Next.js operator UI
apps/api          NestJS REST + WebSocket + job queue
workers/gst-automation   Playwright portal automation
packages/shared-types    Status enums, domain types
packages/gst-form-schema Zod validators
docs/             Field mapping, ops OTP guide
fixtures/         Sample filing pack
infra/            Docker Compose
```

## Environment

See [`.env.example`](.env.example). Set `WORKER_TOKEN` consistently on API and worker.

## Docs

- [GST field mapping](docs/gst-field-mapping.md)
- [Ops OTP access (v1 manual)](docs/ops-otp-access.md)
- [Production deployment (VPS + Docker)](docs/deployment.md)
- [Vercel frontend deployment](docs/vercel-deployment.md)
- [Sample filing pack](fixtures/sample-proprietorship-filing.json)

## Notes

- v1 supports **Proprietorship, Partnership, HUF** via EVC submission
- Pvt Ltd / LLP (DSC) deferred to v2
- Portal UI changes may require selector updates in `workers/gst-automation/src/selectors/`
- **Test mode:** set `window.__test__ = true` in the browser console before starting automation to run with a visible Chromium window; otherwise automation runs headless
