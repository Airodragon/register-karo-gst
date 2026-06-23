import type { Page } from 'playwright';
import type { ApplicationFormData } from '@registerkaro/shared-types';
import { selectors } from '../selectors';
import type { InputWaiter } from '../input-waiter';
import type { ApiClient } from '../api-client';
import { saveSession } from '../session/context-manager';

export interface SubmitResult {
  arn?: string;
  requiresBiometric: boolean;
  requiresAadhaar: boolean;
}

export async function submitWithEvc(
  page: Page,
  applicationId: string,
  jobId: string,
  inputWaiter: InputWaiter,
  api: ApiClient,
): Promise<SubmitResult> {
  await api.reportProgress(applicationId, 'awaiting_evc_otp');
  await api.updateApplication(applicationId, {
    status: 'RUNNING',
    currentStep: 'REVIEW_SUBMIT',
  });

  await page.locator(selectors.partB.submitEvc).first().click().catch(async () => {
    await page.getByRole('button', { name: /SUBMIT WITH EVC/i }).click();
  });
  await page.waitForTimeout(2000);

  await api.updateApplication(applicationId, { status: 'AWAITING_EVC_OTP' });

  const evcOtp = await inputWaiter.requestInput(applicationId, jobId, 'EVC_OTP', {
    message: 'Enter EVC OTP sent to PAS email and mobile on GST portal',
  });
  await inputWaiter.acknowledgeInputReceived(applicationId);

  const otpField = page.locator(selectors.partB.evcOtp).first();
  if (await otpField.count()) {
    await otpField.fill(evcOtp.otp ?? evcOtp.mobileOtp ?? '');
  }

  await page.locator(selectors.partB.validateOtp).first().click().catch(async () => {
    await page.getByRole('button', { name: /VALIDATE OTP/i }).click();
  });
  await page.waitForTimeout(4000);

  const bodyText = (await page.textContent('body')) ?? '';

  if (/biometric|GSK|GST Suvidha Kendra/i.test(bodyText)) {
    await api.reportProgress(applicationId, 'biometric_required');
    await api.updateApplication(applicationId, {
      status: 'BIOMETRIC_REQUIRED',
      errorLog: 'Portal requires GSK biometric visit. Complete offline.',
    });
    return { requiresBiometric: true, requiresAadhaar: false };
  }

  const arnMatch = bodyText.match(selectors.common.arnPattern);
  if (arnMatch) {
    const arn = arnMatch[1];
    await api.reportProgress(applicationId, 'arn_received');
    await api.updateApplication(applicationId, {
      status: 'ARN_RECEIVED',
      currentStep: 'COMPLETE',
      arn,
      pendingInput: null,
      pendingInputData: null,
    });
    return { arn, requiresBiometric: false, requiresAadhaar: false };
  }

  await api.reportProgress(applicationId, 'awaiting_aadhaar');
  await api.updateApplication(applicationId, {
    status: 'AWAITING_AADHAAR',
    currentStep: 'AADHAAR_TRACKING',
  });

  return { requiresBiometric: false, requiresAadhaar: true };
}

export async function trackAadhaarAndArn(
  page: Page,
  applicationId: string,
  jobId: string,
  inputWaiter: InputWaiter,
  api: ApiClient,
): Promise<string | undefined> {
  await inputWaiter.requestInput(applicationId, jobId, 'AADHAAR_OTP', {
    message:
      'Complete Aadhaar authentication via the link sent to promoter/PAS email, then enter confirmation OTP if prompted on portal',
  });
  await inputWaiter.acknowledgeInputReceived(applicationId);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bodyText = (await page.textContent('body')) ?? '';
  const arnMatch = bodyText.match(selectors.common.arnPattern);

  if (arnMatch) {
    const arn = arnMatch[1];
    const session = await saveSession(page);
    await api.reportProgress(applicationId, 'arn_received');
    await api.updateApplication(applicationId, {
      status: 'ARN_RECEIVED',
      currentStep: 'COMPLETE',
      arn,
      portalSession: session,
      pendingInput: null,
      pendingInputData: null,
    });
    await inputWaiter.clearPendingInput(applicationId);
    return arn;
  }

  if (/biometric|GSK/i.test(bodyText)) {
    await api.updateApplication(applicationId, { status: 'BIOMETRIC_REQUIRED' });
    return undefined;
  }

  throw new Error('ARN not found after Aadhaar authentication step');
}

export async function runSubmitFlow(
  page: Page,
  formData: ApplicationFormData,
  applicationId: string,
  jobId: string,
  inputWaiter: InputWaiter,
  api: ApiClient,
): Promise<SubmitResult & { arn?: string }> {
  const method = formData.verification?.submissionMethod ?? 'EVC';

  if (method !== 'EVC') {
    throw new Error('Only EVC submission is supported in v1');
  }

  const submitResult = await submitWithEvc(page, applicationId, jobId, inputWaiter, api);

  if (submitResult.arn) {
    return submitResult;
  }

  if (submitResult.requiresAadhaar) {
    const arn = await trackAadhaarAndArn(page, applicationId, jobId, inputWaiter, api);
    return { ...submitResult, arn };
  }

  return submitResult;
}
