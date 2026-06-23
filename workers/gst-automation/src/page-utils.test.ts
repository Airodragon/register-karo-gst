import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { extractTrnFromText, waitAndExtractTrn } from './page-utils';

describe('waitAndExtractTrn', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('extracts TRN from GST portal success message (digits + TRN suffix)', () => {
    const text =
      'You have successfully submitted Part A of the registration process. Your Temporary Reference Number (TRN) is 072400014077TRN.';
    expect(extractTrnFromText(text)).toBe('072400014077TRN');
  });

  it('extracts TRN from success message text', async () => {
    await page.setContent(`
      <body>
        <h1>Registration Part A</h1>
        <p>Your Temporary Reference Number (TRN) is 072412345678901</p>
      </body>
    `);

    const trn = await waitAndExtractTrn(page, 5000);
    expect(trn).toBe('072412345678901');
  });

  it('extracts TRN near TRN label', async () => {
    await page.setContent(`
      <body>
        <div>TRN: 072498765432109</div>
      </body>
    `);

    const trn = await waitAndExtractTrn(page, 5000);
    expect(trn).toBe('072498765432109');
  });
});
