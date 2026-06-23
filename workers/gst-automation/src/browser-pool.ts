import { Browser, chromium } from 'playwright';

let browser: Browser | null = null;
let currentHeadless: boolean | null = null;

export async function getBrowser(headless: boolean): Promise<Browser> {
  if (browser?.isConnected() && currentHeadless === headless) {
    return browser;
  }
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
    currentHeadless = null;
  }
  browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  currentHeadless = headless;
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
    currentHeadless = null;
  }
}
