# Assignment submission email

Copy and personalize before sending to HR / the hiring team.

---

**Subject:** Assignment Submission — RegisterKaro GST REG-01 Automation Platform

Dear [HR Name / Hiring Team],

I am sharing my completed assignment: **RegisterKaro**, an internal ops platform that automates GST REG-01 registration on the official GST portal through ARN generation.

**Repository:** https://github.com/Airodragon/register-karo-gst

**What I built**

- **Operator dashboard** (Next.js 15, Tailwind) — create filings, multi-step wizard, document upload, live progress, captcha/OTP handoff
- **REST + WebSocket API** (NestJS, Prisma, PostgreSQL) — auth, application lifecycle, audit log, job queue
- **Playwright automation worker** — Part A (TRN), Part B form fill, EVC submission with human-in-the-loop for captcha and OTP
- **Infrastructure** — Redis/BullMQ job queue, MinIO document storage, Docker Compose for local and VPS deployment

**Supported scope (v1):** Proprietorship, Partnership, and HUF via EVC. Pvt Ltd / LLP (DSC) deferred to v2.

**How to run locally**

```bash
cp .env.example .env
pnpm setup
pnpm dev:all
# UI: http://localhost:3000/login (admin@registerkaro.local / admin123)
```

**Demo / test mode:** In the browser console, set `window.__test__ = true` before starting automation to run with a visible Chromium window; otherwise automation runs headless.

**Workflow demonstrated**

1. Create filing → complete wizard → upload documents
2. Start Part A → enter captcha/OTP when prompted → TRN captured
3. Continue to Part B + submit → Aadhaar OTP when prompted → ARN on success

Happy to walk through a live demo or answer questions.

Best regards,  
[Your Name]  
[Phone] | [LinkedIn/GitHub]
