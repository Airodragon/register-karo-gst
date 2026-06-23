import type { Page } from 'playwright';
import { selectors } from './selectors';
import { assertPageOpen } from './page-utils';

/**
 * Captures the GST portal captcha image for human-in-the-loop entry.
 * No automated solving — screenshot only when captcha is present.
 */
export async function captureCaptchaImage(page: Page): Promise<string> {
  assertPageOpen(page);

  const locatorCandidates = [
    selectors.partA.captchaImage,
    '#imgCaptcha',
    'img[id*="Captcha"]',
    'img[src*="Captcha"]',
    'img[src*="captcha"]',
    'label:has-text("Type the characters") >> .. >> img',
    'text=Type the characters >> .. >> .. >> img',
  ];

  for (const selector of locatorCandidates) {
    const el = page.locator(selector).first();
    if ((await el.count()) > 0) {
      try {
        await el.waitFor({ state: 'visible', timeout: 5000 });
        const buffer = await el.screenshot();
        if (buffer.length > 100) {
          return buffer.toString('base64');
        }
      } catch {
        /* try next selector */
      }
    }
  }

  const captchaSection = page.locator('text=/Type the characters/i').first();
  if (await captchaSection.count()) {
    const container = captchaSection.locator('xpath=ancestor::div[1]');
    const img = container.locator('img').first();
    if (await img.count()) {
      const buffer = await img.screenshot();
      return buffer.toString('base64');
    }
  }

  throw new Error(
    'Captcha image not found on GST portal. Ensure the registration page loaded fully.',
  );
}
