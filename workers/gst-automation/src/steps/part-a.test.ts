import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { fillPartAFields } from './part-a';
import type { ApplicationFormData } from '@registerkaro/shared-types';

const fixtureHtml = readFileSync(join(process.cwd(), 'fixtures/part-a-form.html'), 'utf-8');

const samplePartA: ApplicationFormData['partA'] = {
  taxpayerType: 'Taxpayer',
  state: 'Delhi',
  district: 'South West',
  legalName: 'MIHIR SRIVASTAVA',
  pan: 'MWTPS6537D',
  pasEmail: 'mihir190801@gmail.com',
  pasMobile: '8700993995',
};

describe('fillPartAFields', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.setContent(fixtureHtml);
  });

  afterAll(async () => {
    await browser.close();
  });

  it('fills all Part A fields in correct slots', async () => {
    await fillPartAFields(page, samplePartA);

    expect(await page.locator('#applnType').inputValue()).toBe('TP');
    expect(await page.locator('#statecd').inputValue()).toBe('07');
    expect(await page.locator('#districtcd').inputValue()).toBe('SW');
    expect(await page.locator('#lgnm').inputValue()).toBe('MIHIR SRIVASTAVA');
    expect(await page.locator('#pan').inputValue()).toBe('MWTPS6537D');
    expect(await page.locator('#email').inputValue()).toBe('mihir190801@gmail.com');
    expect(await page.locator('#mobile').inputValue()).toBe('8700993995');
  });

  it('does not put PAN into legal name via broad /PAN/i label', async () => {
    await page.setContent(fixtureHtml);
    const broadPan = page.getByLabel(/PAN/i);
    const count = await broadPan.count();
    expect(count).toBeGreaterThan(0);

    await broadPan.first().fill('WRONG_VALUE');
    const legalName = await page.locator('#lgnm').inputValue();
    expect(legalName).toBe('WRONG_VALUE');

    await page.locator('#lgnm').fill('');
    await page.locator('#pan').fill('');
  });
});
