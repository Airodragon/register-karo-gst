import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { fillTrnInput } from './form-utils';

describe('fillTrnInput', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('fills TRN text input and skips the TRN radio button', async () => {
    await page.setContent(`
      <form>
        <label for="radiotrn">Temporary Reference Number (TRN)</label>
        <input value="T" name="typ" type="radio" id="radiotrn" />
        <label for="trninp">Temporary Reference Number (TRN)</label>
        <input type="text" id="trninp" name="trninp" />
      </form>
    `);

    await fillTrnInput(page, '072600194907TRN');

    expect(await page.locator('#trninp').inputValue()).toBe('072600194907TRN');
    expect(await page.locator('#radiotrn').isChecked()).toBe(false);
  });
});
