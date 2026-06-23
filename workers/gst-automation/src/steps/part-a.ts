import type { Page } from 'playwright';
import type { ApplicationFormData } from '@registerkaro/shared-types';
import { selectors } from '../selectors';
import type { InputWaiter } from '../input-waiter';
import type { ApiClient } from '../api-client';
import { saveSession } from '../session/context-manager';
import { assertPageOpen, ensureOtpScreenReady, safeWait, waitAndExtractTrn, waitForTrnLoginOtpOrPartB, isOnPartBDashboard, isPartASuccessScreen, TRN_LOGIN_OTP_SELECTORS } from '../page-utils';
import {
  districtAliases,
  fillInputByLabel,
  fillTrnInput,
  firstVisibleLocator,
  selectDropdown,
  toPartAExpected,
  verifyPartAFields,
  waitForDistrictOptions,
} from '../form-utils';

export interface PartAResult {
  trn: string;
  trnExpiresAt: Date;
}

async function navigateToNewRegistration(page: Page, portalUrl: string): Promise<void> {
  const registrationUrl =
    process.env.GST_REGISTRATION_URL ?? 'https://reg.gst.gov.in/registration';

  await page.goto(registrationUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await safeWait(page, 2000);

  const onRegistrationForm = await page
    .locator(`${selectors.partA.pan}, ${selectors.partA.stateDropdown}`)
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (onRegistrationForm) return;

  await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await safeWait(page, 2000);

  const registerLink = page.locator(selectors.navigation.registerNow).first();
  if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await registerLink.click({ force: true });
    await safeWait(page, 2000);
    return;
  }

  await page.goto(registrationUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await safeWait(page, 2000);
}

export async function fillPartAFields(
  page: Page,
  partA: ApplicationFormData['partA'],
): Promise<void> {
  const newRegRadio = page.locator(selectors.partA.newRegistrationRadio).first();
  if (await newRegRadio.count()) {
    await newRegRadio.check().catch(() => newRegRadio.click({ force: true }));
    await safeWait(page, 500);
  }

  await selectDropdown(page, selectors.partA.taxpayerDropdown, partA.taxpayerType);
  await safeWait(page, 500);

  await selectDropdown(page, selectors.partA.stateDropdown, partA.state);
  const stateSelect = await firstVisibleLocator(page, selectors.partA.stateDropdown);
  await stateSelect.evaluate((el) => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await safeWait(page, 1200);

  await waitForDistrictOptions(page, selectors.partA.districtDropdown, 15000);
  await selectDropdown(
    page,
    selectors.partA.districtDropdown,
    partA.district,
    districtAliases(partA.district, partA.state),
  );
  await safeWait(page, 500);

  await fillInputByLabel(
    page,
    selectors.partA.fieldLabels.legalName,
    partA.legalName,
    selectors.partA.legalName,
    { labelFirst: true },
  );
  await safeWait(page, 400);

  await fillInputByLabel(
    page,
    selectors.partA.fieldLabels.pan,
    partA.pan,
    selectors.partA.pan,
    { labelFirst: true },
  );
  await fillInputByLabel(
    page,
    selectors.partA.fieldLabels.email,
    partA.pasEmail,
    selectors.partA.email,
  );
  await fillInputByLabel(
    page,
    selectors.partA.fieldLabels.mobile,
    partA.pasMobile,
    selectors.partA.mobile,
  );

  await verifyPartAFields(page, toPartAExpected(partA));
}

async function tryFillOtp(
  page: Page,
  labelPatterns: RegExp[],
  selector: string,
  value: string,
): Promise<boolean> {
  if (!value.trim()) return false;

  const bySelector = page.locator(selector).first();
  if (await bySelector.count()) {
    await bySelector.fill(value);
    return true;
  }

  for (const pattern of labelPatterns) {
    const field = page.getByLabel(pattern, { exact: false }).first();
    if (await field.count()) {
      await field.fill(value);
      return true;
    }
  }

  return false;
}

async function fillPartAOtpFields(
  page: Page,
  mobileOtp: string,
  emailOtp: string,
): Promise<void> {
  const mobile = mobileOtp.trim();
  const email = emailOtp.trim();

  let mobileFilled = await tryFillOtp(
    page,
    selectors.partA.fieldLabels.mobileOtp,
    selectors.partA.mobileOtp,
    mobile,
  );
  let emailFilled = await tryFillOtp(
    page,
    selectors.partA.fieldLabels.emailOtp,
    selectors.partA.emailOtp,
    email,
  );

  if (!mobileFilled || !emailFilled) {
    const otpInputs = page.locator(
      'input[name*="otp" i]:visible, input[id*="otp" i]:visible, input[placeholder*="OTP" i]:visible',
    );
    const count = await otpInputs.count();
    if (count >= 2) {
      if (!mobileFilled) {
        await otpInputs.nth(0).fill(mobile);
        mobileFilled = true;
      }
      if (!emailFilled) {
        await otpInputs.nth(1).fill(email);
        emailFilled = true;
      }
    } else if (count === 1 && mobile && !emailFilled && !email) {
      await otpInputs.first().fill(mobile);
      mobileFilled = true;
    }
  }

  if (!mobileFilled || !emailFilled) {
    throw new Error(
      'Could not fill Part A OTP fields on GST portal. Enter mobile and email OTP separately in the app.',
    );
  }
}

async function submitPartAAfterOtp(page: Page): Promise<void> {
  const validateBtn = page.locator(selectors.partA.validateOtpButton).first();
  if (await validateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await validateBtn.click();
    await safeWait(page, 2000);
  }

  const proceed = page.locator(selectors.partA.proceedButton).first();
  await proceed.click();
  await safeWait(page, 2500);

  if (await proceed.isVisible({ timeout: 3000 }).catch(() => false)) {
    await proceed.click();
    await safeWait(page, 2500);
  }

  const validateAgain = page.locator(selectors.partA.validateOtpButton).first();
  if (await validateAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
    await validateAgain.click();
    await safeWait(page, 2000);
    if (await proceed.isVisible({ timeout: 2000 }).catch(() => false)) {
      await proceed.click();
      await safeWait(page, 2500);
    }
  }
}

export async function runPartA(
  page: Page,
  formData: ApplicationFormData,
  applicationId: string,
  jobId: string,
  inputWaiter: InputWaiter,
  api: ApiClient,
  portalUrl: string,
): Promise<PartAResult> {
  const { partA } = formData;

  await api.reportProgress(applicationId, 'part_a_start');
  await api.updateApplication(applicationId, {
    status: 'RUNNING',
    currentStep: 'CLIENT_PART_A',
  });

  await navigateToNewRegistration(page, portalUrl);
  await api.reportProgress(applicationId, 'part_a_fill');

  await fillPartAFields(page, partA);

  await api.reportProgress(applicationId, 'awaiting_captcha');
  assertPageOpen(page);
  const captchaImage = await inputWaiter.captureCaptcha(page);
  const captchaInput = await inputWaiter.requestInput(applicationId, jobId, 'CAPTCHA', {
    captchaImageBase64: captchaImage,
    message: 'Enter the captcha shown on the GST portal',
  });
  await inputWaiter.acknowledgeInputReceived(applicationId);

  const captchaField = page.locator(selectors.partA.captchaInput).first();
  if (await captchaField.count()) {
    await captchaField.fill(captchaInput.captcha ?? '');
  }

  assertPageOpen(page);
  await page.locator(selectors.partA.proceedButton).first().click();
  await safeWait(page, 2000);

  const proceedAgain = page.locator(selectors.partA.proceedButton).first();
  if (await proceedAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
    await proceedAgain.click();
    await safeWait(page, 1500);
  }

  await ensureOtpScreenReady(page, [
    selectors.partA.mobileOtp,
    selectors.partA.emailOtp,
    'input[name*="otp" i]',
    'input[id*="otp" i]',
  ]);

  await api.reportProgress(applicationId, 'awaiting_part_a_otp');
  const otpInput = await inputWaiter.requestInput(applicationId, jobId, 'PART_A_OTP', {
    message: 'Enter mobile OTP and email OTP (they are different)',
  });

  await api.reportProgress(applicationId, 'part_a_otp_submitted');
  await inputWaiter.acknowledgeInputReceived(applicationId);

  await fillPartAOtpFields(
    page,
    otpInput.mobileOtp ?? otpInput.otp ?? '',
    otpInput.emailOtp ?? '',
  );

  assertPageOpen(page);
  await submitPartAAfterOtp(page);

  await api.reportProgress(applicationId, 'trn_received');
  const trn = await waitAndExtractTrn(page);
  const trnExpiresAt = new Date();
  trnExpiresAt.setDate(trnExpiresAt.getDate() + 15);

  const session = await saveSession(page);

  await api.updateApplication(applicationId, {
    status: 'TRN_RECEIVED',
    currentStep: 'BUSINESS',
    trn,
    trnExpiresAt: trnExpiresAt.toISOString(),
    portalSession: session,
    pendingInput: null,
    pendingInputData: null,
  });

  await inputWaiter.clearPendingInput(applicationId);
  return { trn, trnExpiresAt };
}

export async function loginWithTrn(
  page: Page,
  trn: string,
  applicationId: string,
  jobId: string,
  inputWaiter: InputWaiter,
  api: ApiClient,
  _portalUrl: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'trn_login');

  if (await isOnPartBDashboard(page)) {
    const editIcon = page.locator(selectors.partB.editIcon).first();
    if (await editIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editIcon.click();
      await safeWait(page, 2000);
    }
    await api.updateApplication(applicationId, {
      status: 'PART_B_IN_PROGRESS',
      currentStep: 'BUSINESS',
    });
    return;
  }

  if (await isPartASuccessScreen(page)) {
    const proceed = page.locator(selectors.partA.proceedButton).first();
    if (await proceed.isVisible({ timeout: 3000 }).catch(() => false)) {
      await proceed.click();
      await safeWait(page, 3000);
    }
    if (await isOnPartBDashboard(page)) {
      const editIcon = page.locator(selectors.partB.editIcon).first();
      if (await editIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
        await editIcon.click();
        await safeWait(page, 2000);
      }
      await api.updateApplication(applicationId, {
        status: 'PART_B_IN_PROGRESS',
        currentStep: 'BUSINESS',
      });
      return;
    }
  }

  const registrationUrl =
    process.env.GST_REGISTRATION_URL ?? 'https://reg.gst.gov.in/registration';

  async function selectTrnRadio(): Promise<void> {
    const trnRadio = page.locator(selectors.partA.trnRadio).first();
    if (await trnRadio.count()) {
      await trnRadio.check().catch(() => trnRadio.click({ force: true }));
    } else {
      await page.getByText(/Temporary Reference Number/i).first().click().catch(() => {});
    }
    await safeWait(page, 800);
  }

  await page.goto(registrationUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await safeWait(page, 2000);

  await selectTrnRadio();

  await fillTrnInput(page, trn);

  const captchaImage = await inputWaiter.captureCaptcha(page);
  await api.reportProgress(applicationId, 'awaiting_trn_captcha');
  const captchaInput = await inputWaiter.requestInput(applicationId, jobId, 'TRN_LOGIN_CAPTCHA', {
    captchaImageBase64: captchaImage,
    message: 'Enter captcha for TRN login',
  });
  await inputWaiter.acknowledgeInputReceived(applicationId);

  const captchaField = page.locator(selectors.partA.captchaInput).first();
  if (await captchaField.count()) {
    await captchaField.fill(captchaInput.captcha ?? '');
  }

  assertPageOpen(page);
  await page.locator(selectors.partA.proceedButton).first().click();
  await safeWait(page, 2500);

  const afterProceed = await waitForTrnLoginOtpOrPartB(page);

  if (afterProceed === 'otp') {
    await api.reportProgress(applicationId, 'awaiting_trn_otp');
    const otpInput = await inputWaiter.requestInput(applicationId, jobId, 'TRN_LOGIN_OTP', {
      message: 'Enter OTP (same on mobile and email for TRN login)',
    });
    await inputWaiter.acknowledgeInputReceived(applicationId);

    const otpValue = otpInput.otp ?? otpInput.mobileOtp ?? '';
    const otpField = page.locator(selectors.common.otpSingle).first();
    if (await otpField.count()) {
      await otpField.fill(otpValue);
    } else {
      const otpInputs = page.locator(TRN_LOGIN_OTP_SELECTORS.join(', '));
      if (await otpInputs.count()) {
        await otpInputs.first().fill(otpValue);
      } else {
        await page.locator('input[type="text"]').last().fill(otpValue);
      }
    }

    assertPageOpen(page);
    await page.locator(selectors.partA.proceedButton).first().click();
    await safeWait(page, 3000);

    const proceedAgain = page.locator(selectors.partA.proceedButton).first();
    if (await proceedAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
      await proceedAgain.click();
      await safeWait(page, 2000);
    }
  }

  let onPartB = await isOnPartBDashboard(page);

  if (!onPartB) {
    await page.goto(registrationUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await safeWait(page, 1500);
    await selectTrnRadio();
    await fillTrnInput(page, trn);
    onPartB = await isOnPartBDashboard(page);
  }

  if (!onPartB) {
    throw new Error(
      'Could not reach Part B dashboard after TRN login. Verify TRN, captcha, and OTP, then use Resume Part B.',
    );
  }

  const editIcon = page.locator(selectors.partB.editIcon).first();
  if (await editIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editIcon.click();
    await safeWait(page, 2000);
  }

  await api.updateApplication(applicationId, {
    status: 'PART_B_IN_PROGRESS',
    currentStep: 'BUSINESS',
  });
}
