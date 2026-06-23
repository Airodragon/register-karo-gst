import type { Page } from 'playwright';

export class BrowserClosedError extends Error {
  constructor() {
    super('Automation browser was closed. Keep the Chrome window open until the run finishes or cancel from the app.');
    this.name = 'BrowserClosedError';
  }
}

export function assertPageOpen(page: Page): void {
  if (page.isClosed()) {
    throw new BrowserClosedError();
  }
}

export async function safeWait(page: Page, ms: number): Promise<void> {
  assertPageOpen(page);
  try {
    await page.waitForTimeout(ms);
  } catch (error) {
    if (page.isClosed() || isClosedError(error)) {
      throw new BrowserClosedError();
    }
    throw error;
  }
}

function isClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /closed|target.*browser/i.test(message);
}

export function wrapPage(page: Page): void {
  page.on('close', () => {
    // no-op; checks use page.isClosed()
  });
}

/** Read visible GST portal validation / error messages after form submit. */
export async function readPortalErrors(page: Page): Promise<string | null> {
  const snippets: string[] = [];

  const alertSelectors = [
    '.alert-danger',
    '.alert-error',
    '.errorMessage',
    '[role="alert"]',
    '.ng-invalid-required',
  ];

  for (const sel of alertSelectors) {
    const texts = await page.locator(sel).allTextContents().catch(() => []);
    for (const t of texts) {
      const trimmed = t.replace(/\s+/g, ' ').trim();
      if (trimmed.length > 5 && trimmed.length < 300) {
        snippets.push(trimmed);
      }
    }
  }

  const body = (await page.textContent('body').catch(() => '')) ?? '';
  const patterns = [
    /PAN\s+.{0,80}(invalid|not valid|does not match|mismatch)/i,
    /legal name.{0,80}(invalid|not match|mismatch)/i,
    /mobile.{0,60}(invalid|not valid)/i,
    /email.{0,60}(invalid|not valid)/i,
    /captcha.{0,40}(invalid|incorrect|wrong)/i,
    /otp.{0,60}(invalid|incorrect|wrong|expired|mismatch)/i,
    /(invalid|incorrect|wrong|expired).{0,40}otp/i,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m) snippets.push(m[0].replace(/\s+/g, ' ').trim());
  }

  const unique = [...new Set(snippets)].filter(Boolean);
  return unique.length ? unique.slice(0, 3).join(' | ') : null;
}

/** Wait until OTP inputs appear, or throw with a helpful portal error. */
export async function ensureOtpScreenReady(
  page: Page,
  otpSelectors: string[],
): Promise<void> {
  await safeWait(page, 1500);

  for (const sel of otpSelectors) {
    const visible = await page
      .locator(sel)
      .first()
      .isVisible({ timeout: 12000 })
      .catch(() => false);
    if (visible) return;
  }

  const portalError = await readPortalErrors(page);
  if (portalError) {
    throw new Error(
      `GST portal rejected the form: ${portalError}. Fix PAN, legal name (must match IT records), mobile and email, then cancel and retry.`,
    );
  }

  throw new Error(
    'GST portal did not show the OTP screen. OTP is only sent for a valid PAN and legal name that match Income Tax records. Check the Chrome automation window for errors, update your filing details, cancel automation, and retry.',
  );
}

const TRN_CONTEXT_PATTERNS = [
  /Temporary Reference Number\s*\(TRN\)\s*is\s*(\d{10,15}TRN|\d{15})/i,
  /TRN\s*(?:is|:|-)?\s*(\d{10,15}TRN|\d{15})/i,
  /Temporary Reference Number[\s\S]{0,80}?(\d{10,15}TRN|\d{15})/i,
  /(\d{15})\s+is\s+(?:your\s+)?(?:TRN|Temporary Reference Number)/i,
  /successfully[\s\S]{0,160}?(\d{10,15}TRN|\d{15})/i,
  /\b(\d{10,15}TRN)\b/i,
];

/** Extract GST TRN from portal page text (supports `072400014077TRN` and 15-digit formats). */
export function extractTrnFromText(text: string): string | null {
  for (const re of TRN_CONTEXT_PATTERNS) {
    const match = text.match(re);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

export async function isPartASuccessScreen(page: Page): Promise<boolean> {
  const body = (await page.textContent('body').catch(() => '')) ?? '';
  return (
    /successfully submitted Part A/i.test(body) ||
    /Temporary Reference Number\s*\(TRN\)\s*is/i.test(body) ||
    !!extractTrnFromText(body)
  );
}

/** Poll the portal for a TRN after Part A OTP submission. */
export async function waitAndExtractTrn(page: Page, timeoutMs = 45000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const body = (await page.textContent('body').catch(() => '')) ?? '';
    const trn = extractTrnFromText(body);
    if (trn) return trn;

    const trnLocator = page.locator(
      'text=/Temporary Reference Number/i, text=/\\bTRN\\b/i, [id*="trn" i], [class*="trn" i]',
    );
    const count = await trnLocator.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = (await trnLocator.nth(i).textContent().catch(() => '')) ?? '';
      const fromNode = extractTrnFromText(text);
      if (fromNode) return fromNode;
    }

    const portalError = await readPortalErrors(page);
    if (portalError && /otp|invalid|incorrect|wrong|expired/i.test(portalError)) {
      throw new Error(`GST portal rejected OTP: ${portalError}`);
    }

    await safeWait(page, 1000);
  }

  const portalError = await readPortalErrors(page);
  if (portalError) {
    throw new Error(`TRN not found after Part A submission. Portal message: ${portalError}`);
  }

  throw new Error(
    'TRN not found on page after Part A submission. Verify both mobile and email OTPs were correct, then check the Chrome automation window for a success screen with your TRN.',
  );
}

export const TRN_LOGIN_OTP_SELECTORS = [
  'input[name*="otp" i]:visible',
  'input[id*="otp" i]:visible',
  'input[placeholder*="OTP" i]:visible',
];

/** After TRN login PROCEED: wait for OTP field or Part B dashboard. */
export async function waitForTrnLoginOtpOrPartB(
  page: Page,
  timeoutMs = 15000,
): Promise<'otp' | 'part_b'> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const onPartB = await page
      .locator('text=Business Details')
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (onPartB) return 'part_b';

    for (const sel of TRN_LOGIN_OTP_SELECTORS) {
      const visible = await page
        .locator(sel)
        .first()
        .isVisible({ timeout: 300 })
        .catch(() => false);
      if (visible) return 'otp';
    }

    await safeWait(page, 500);
  }

  const portalError = await readPortalErrors(page);
  if (portalError) {
    throw new Error(`GST portal rejected TRN login: ${portalError}`);
  }

  throw new Error(
    'TRN login did not show OTP screen or Part B dashboard. Check captcha and TRN in the Chrome window.',
  );
}

export async function isOnPartBDashboard(page: Page): Promise<boolean> {
  return page
    .locator('text=Business Details')
    .first()
    .isVisible({ timeout: 3000 })
    .catch(() => false);
}
