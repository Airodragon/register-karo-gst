# Deploy frontend to Vercel

Vercel hosts the **Next.js dashboard only**. The NestJS API, Playwright worker, Postgres, Redis, and MinIO must run elsewhere (local machine, VPS, Railway, Render, etc.).

## What works on Vercel

| Service | Vercel |
|---------|--------|
| Next.js UI (`apps/web`) | Yes |
| NestJS API + WebSockets | No |
| Playwright worker | No |
| Postgres / Redis / MinIO | No |

The live UI on Vercel calls your API via `NEXT_PUBLIC_API_URL`.

## Option A — Vercel + GitHub (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import **Airodragon/register-karo-gst**
2. Configure the project:

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | *(leave default — uses `apps/web/vercel.json`)* |
| **Install Command** | *(leave default)* |

3. Add **Environment Variables**:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | Public URL of your API, e.g. `https://api.your-domain.com` or `http://YOUR_VPS_IP:3001` for testing |

4. Click **Deploy**

Every push to `main` redeploys the frontend automatically.

## Option B — Vercel CLI

```bash
# One-time login (opens browser)
npx vercel login

# From repo root — deploy preview
pnpm deploy:vercel

# Production
pnpm deploy:vercel:prod
```

Set `NEXT_PUBLIC_API_URL` in the Vercel dashboard (**Project → Settings → Environment Variables**) before deploying.

## Running the API for a Vercel frontend

### Local API + Vercel UI (quick demo)

1. Start backend locally:

```bash
pnpm docker:up
pnpm dev:api
pnpm dev:worker
```

2. Expose API with a tunnel (required — Vercel is HTTPS, needs a public API URL):

```bash
npx ngrok http 3001
```

3. Set `NEXT_PUBLIC_API_URL` in Vercel to the ngrok URL (e.g. `https://abc123.ngrok-free.app`)

4. Set `CORS_ORIGIN` in your local `.env` to your Vercel URL (e.g. `https://register-karo-gst.vercel.app`)

5. Redeploy Vercel after changing env vars.

### Production API (VPS)

Deploy the full backend using [deployment.md](./deployment.md) on a VPS, then set:

- `NEXT_PUBLIC_API_URL` on Vercel → `https://your-vps-domain.com`
- `CORS_ORIGIN` on the API → your Vercel URL

## Limitations

- **Automation** requires the Playwright worker running wherever the API is hosted — not on Vercel.
- **WebSockets** (`socket.io`) need the API reachable from the browser; ngrok or a real domain works.
- **Mixed content**: if Vercel is HTTPS, the API URL must also be HTTPS.

## Full-stack alternatives

For one URL with everything (API + worker + DB), use [VPS Docker deployment](./deployment.md) instead of Vercel.
