import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ApiClient } from './api-client';
import { InputWaiter } from './input-waiter';
import { runPartA, loginWithTrn } from './steps/part-a';
import { runPartB } from './steps/part-b';
import { resolveDocuments } from './document-resolver';
import { runSubmitFlow } from './steps/submit-arn';
import { restoreSession } from './session/context-manager';
import { CancelMonitor, JobCancelledError } from './cancel-monitor';
import { BrowserClosedError, wrapPage, extractTrnFromText } from './page-utils';
import { getBrowser, closeBrowser } from './browser-pool';
import type { ApplicationFormData } from '@registerkaro/shared-types';
import type { Page } from 'playwright';

const GST_AUTOMATION_QUEUE = 'gst-automation';

function nextStepAfterFailure(step: string): string {
  if (step === 'part_b_resume') return 'part_b_resume';
  if (step === 'part_b' || step === 'submit') return step;
  return 'part_a';
}

async function captureFailureScreenshot(page: Page | undefined, api: ApiClient, applicationId: string) {
  if (!page) return;
  try {
    const buffer = await page.screenshot({ fullPage: true });
    await api.uploadFailureScreenshot(applicationId, buffer);
  } catch {
    /* ignore screenshot errors */
  }
}

async function main() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const workerToken = process.env.WORKER_TOKEN ?? 'worker-dev-token';
  const portalUrl = process.env.GST_PORTAL_URL ?? 'https://www.gst.gov.in';
  const defaultHeadless = process.env.HEADLESS !== 'false';
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10);

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const api = new ApiClient(apiUrl, workerToken);
  const inputWaiter = new InputWaiter(connection, apiUrl, workerToken);
  const cancelMonitor = new CancelMonitor(connection);

  console.log(
    `GST automation worker started (concurrency: ${concurrency}, defaultHeadless: ${defaultHeadless})`,
  );

  const worker = new Worker(
    GST_AUTOMATION_QUEUE,
    async (job) => {
      const { applicationId, step, headless: jobHeadless } = job.data as {
        applicationId: string;
        step: string;
        headless?: boolean;
      };
      const headless = jobHeadless ?? defaultHeadless;
      const jobId = job.id ?? applicationId;
      const resumeStep = nextStepAfterFailure(step);

      console.log(`Processing job ${jobId} for application ${applicationId}, step: ${step}`);

      await cancelMonitor.assertNotCancelled(applicationId);

      const application = await api.getApplication(applicationId);
      const formData = application.formData as ApplicationFormData;

      const browser = await getBrowser(headless);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      await restoreSession(context, application.portalSession as Parameters<typeof restoreSession>[1]);

      const page = await context.newPage();
      wrapPage(page);

      try {
        if (resumeStep === 'part_a' || !application.trn) {
          await cancelMonitor.assertNotCancelled(applicationId);
          await runPartA(page, formData, applicationId, jobId, inputWaiter, api, portalUrl);
        }

        await cancelMonitor.assertNotCancelled(applicationId);
        const refreshed = await api.getApplication(applicationId);
        const trn = refreshed.trn ?? application.trn;

        const needsTrnLogin =
          !!trn &&
          (resumeStep === 'part_a' ||
            resumeStep === 'part_b' ||
            resumeStep === 'part_b_resume' ||
            resumeStep === 'submit');
        const needsPartB =
          !!trn &&
          (resumeStep === 'part_a' ||
            resumeStep === 'part_b' ||
            resumeStep === 'part_b_resume');

        if (needsTrnLogin) {
          await cancelMonitor.assertNotCancelled(applicationId);
          await loginWithTrn(page, trn, applicationId, jobId, inputWaiter, api, portalUrl);
        }

        if (needsPartB) {
          await cancelMonitor.assertNotCancelled(applicationId);
          const docs = await resolveDocuments(api, applicationId, application.constitution);
          await runPartB(page, formData, api, applicationId, docs, application.constitution);
        }

        if (
          trn &&
          (resumeStep === 'submit' ||
            resumeStep === 'part_b' ||
            resumeStep === 'part_b_resume' ||
            resumeStep === 'part_a')
        ) {
          await cancelMonitor.assertNotCancelled(applicationId);
          await runSubmitFlow(page, formData, applicationId, jobId, inputWaiter, api);
        }

        await api.completeJob(applicationId, true);
      } catch (error) {
        if (error instanceof JobCancelledError) {
          console.log(`Job ${jobId} cancelled for application ${applicationId}`);
          return;
        }

        await captureFailureScreenshot(page, api, applicationId);

        const message =
          error instanceof BrowserClosedError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        console.error(`Job failed: ${message}`);

        let hasTrn = !!application.trn;
        let recoveredTrn: string | undefined;
        try {
          if (!page.isClosed()) {
            const body = (await page.textContent('body').catch(() => '')) ?? '';
            recoveredTrn = extractTrnFromText(body) ?? undefined;
          }
        } catch {
          /* ignore portal read errors */
        }

        try {
          const latest = await api.getApplication(applicationId);
          hasTrn = !!(latest.trn ?? application.trn ?? recoveredTrn);
        } catch {
          hasTrn = hasTrn || !!recoveredTrn;
        }

        try {
          await api.reportProgress(applicationId, 'failed');
          await api.updateApplication(applicationId, {
            status: hasTrn ? 'TRN_RECEIVED' : 'FAILED',
            ...(recoveredTrn && !application.trn ? { trn: recoveredTrn } : {}),
            errorLog: hasTrn && recoveredTrn ? null : message,
            pendingInput: null,
            pendingInputData: null,
          });
        } catch {
          await api.updateApplication(applicationId, {
            status: hasTrn ? 'TRN_RECEIVED' : 'FAILED',
            errorLog: message,
          });
        }

        await api.completeJob(applicationId, false, message);
        throw error;
      } finally {
        await context.close().catch(() => undefined);
      }
    },
    { connection: connection as never, concurrency },
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', async (job, err) => {
    if (err instanceof JobCancelledError || /cancelled/i.test(err.message)) {
      return;
    }
    console.error(`Job ${job?.id} failed:`, err.message);
    if (!job?.data) return;
    const { applicationId } = job.data as { applicationId: string };
    try {
      const latest = await api.getApplication(applicationId);
      const hasTrn = !!latest.trn;
      await api.reportProgress(applicationId, 'failed');
      await api.updateApplication(applicationId, {
        status: hasTrn ? 'TRN_RECEIVED' : 'FAILED',
        errorLog: err.message,
        pendingInput: null,
        pendingInputData: null,
      });
    } catch (updateErr) {
      console.error('Failed to mark application as failed:', updateErr);
    }
  });

  process.on('SIGTERM', async () => {
    await worker.close();
    await closeBrowser();
    connection.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
