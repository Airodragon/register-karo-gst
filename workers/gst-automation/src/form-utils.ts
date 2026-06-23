import type { Locator, Page } from 'playwright';
import type { ApplicationFormData } from '@registerkaro/shared-types';
import { selectors } from './selectors';
import { safeWait } from './page-utils';

export interface PartAExpected {
  taxpayerType: string;
  state: string;
  district: string;
  legalName: string;
  pan: string;
  pasEmail: string;
  pasMobile: string;
}

export async function firstVisibleLocator(
  page: Page,
  compositeSelector: string,
  timeoutMs = 20000,
): Promise<Locator> {
  const parts = compositeSelector.split(',').map((s) => s.trim()).filter(Boolean);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const part of parts) {
      const locator = page.locator(part).first();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    await safeWait(page, 300);
  }

  throw new Error(`No visible element for selectors: ${compositeSelector}`);
}

const FILLABLE_INPUT_TYPES = new Set(['text', 'tel', 'email', 'number', 'search', 'password', '']);

async function isFillableField(field: Locator): Promise<boolean> {
  if (!(await field.count())) return false;
  const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
  if (tag === 'textarea') return true;
  if (tag !== 'input') return false;
  const type = ((await field.getAttribute('type')) ?? 'text').toLowerCase();
  return FILLABLE_INPUT_TYPES.has(type);
}

async function fillFirstFillable(fields: Locator, value: string): Promise<boolean> {
  const count = await fields.count();
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    if (!(await field.isVisible().catch(() => false))) continue;
    if (await isFillableField(field)) {
      await field.fill(value);
      return true;
    }
  }
  return false;
}

export async function firstFillableLocator(
  page: Page,
  compositeSelector: string,
  timeoutMs = 20000,
): Promise<Locator> {
  const parts = compositeSelector.split(',').map((s) => s.trim()).filter(Boolean);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const part of parts) {
      const all = page.locator(part);
      const count = await all.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const locator = all.nth(i);
        if ((await locator.isVisible().catch(() => false)) && (await isFillableField(locator))) {
          return locator;
        }
      }
    }
    await safeWait(page, 300);
  }

  throw new Error(`No fillable element for selectors: ${compositeSelector}`);
}

export async function fillTrnInput(page: Page, trn: string): Promise<void> {
  const selectorList = [
    selectors.partB.trnInput,
    'input[type="text"][placeholder*="TRN" i]',
    'input[type="text"][placeholder*="Temporary Reference" i]',
  ];

  for (const sel of selectorList) {
    const field = await firstFillableLocator(page, sel, 4000).catch(() => null);
    if (field) {
      await field.fill(trn);
      return;
    }
  }

  for (const pattern of [/Temporary Reference Number/i, /^TRN$/i]) {
    const fields = page.getByLabel(pattern, { exact: false });
    if (await fillFirstFillable(fields, trn)) return;
  }

  throw new Error(
    'Could not find TRN text input on GST login page. Ensure the Temporary Reference Number radio is selected.',
  );
}

export async function fillInputByLabel(
  page: Page,
  labelPatterns: RegExp[],
  value: string,
  idSelector?: string,
  options?: { labelFirst?: boolean },
): Promise<void> {
  const tryLabels = async () => {
    for (const pattern of labelPatterns) {
      const fields = page.getByLabel(pattern, { exact: false });
      if (await fillFirstFillable(fields, value)) return true;
    }
    return false;
  };

  const tryId = async () => {
    if (!idSelector) return false;
    const byId = await firstFillableLocator(page, idSelector, 3000).catch(() => null);
    if (!byId) return false;
    await byId.fill(value);
    return true;
  };

  if (options?.labelFirst) {
    if (await tryLabels()) return;
    if (await tryId()) return;
  } else {
    if (await tryId()) return;
    if (await tryLabels()) return;
  }

  throw new Error(
    `Could not find input for labels: ${labelPatterns.map((p) => p.source).join(', ')}`,
  );
}

export async function selectDropdown(
  page: Page,
  selector: string,
  value: string,
  aliases: string[] = [],
): Promise<void> {
  const select = await firstVisibleLocator(page, selector);
  await select.waitFor({ state: 'visible', timeout: 20000 });

  const candidates = [value, ...aliases.filter((a) => a !== value)];

  const trySelect = async (optionLabel: string) => {
    try {
      await select.selectOption({ label: optionLabel });
      return true;
    } catch {
      /* try fuzzy */
    }

    const options = await select.locator('option').evaluateAll((els) =>
      els
        .map((el) => ({
          value: (el as HTMLOptionElement).value,
          label: el.textContent?.trim() ?? '',
        }))
        .filter((o) => {
          const lower = o.label.toLowerCase();
          return Boolean(o.value) && o.label && lower !== 'select' && lower !== 'choose';
        }),
    );

    const normalized = optionLabel.toLowerCase().replace(/\s+/g, ' ');
    const match = options.find(
      (o) =>
        o.label.toLowerCase() === normalized ||
        o.label.toLowerCase().includes(normalized) ||
        normalized.includes(o.label.toLowerCase()),
    );

    if (match) {
      await select.selectOption(match.value);
      return true;
    }

    return false;
  };

  for (const candidate of candidates) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await trySelect(candidate)) return;
      await safeWait(page, 800);
    }
  }

  throw new Error(`Could not select "${value}" in dropdown ${selector}`);
}

export async function waitForDistrictOptions(
  page: Page,
  districtSelector: string,
  timeoutMs = 10000,
): Promise<Locator> {
  const select = await firstVisibleLocator(page, districtSelector);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const optionCount = await select.locator('option').evaluateAll((els) =>
      els.filter((el) => {
        const value = (el as HTMLOptionElement).value;
        const label = el.textContent?.trim().toLowerCase() ?? '';
        return Boolean(value) && label && label !== 'select' && label !== 'choose';
      }).length,
    );
    if (optionCount > 0) return select;
    await safeWait(page, 400);
  }

  throw new Error('District dropdown did not populate after state selection');
}

export function districtAliases(district: string, state: string): string[] {
  const aliases = [district];
  if (state === 'Delhi' && district === 'South West') {
    aliases.push('South West Delhi', 'South West Delhi District');
  }
  return aliases;
}

async function readSelectValue(page: Page, selector: string): Promise<string> {
  const select = await firstVisibleLocator(page, selector, 5000).catch(() => null);
  if (!select) return '';

  return select.locator('option:checked').first().textContent().then((t) => t?.trim() ?? '');
}

async function readInputValue(page: Page, selector: string, labelPatterns?: RegExp[]): Promise<string> {
  const input = await firstVisibleLocator(page, selector, 5000).catch(() => null);
  if (input) {
    const value = await input.inputValue();
    if (value.trim()) return value;
  }

  if (labelPatterns) {
    for (const pattern of labelPatterns) {
      const field = page.getByLabel(pattern, { exact: false }).first();
      if (await field.count()) {
        const value = await field.inputValue();
        if (value.trim()) return value;
      }
    }
  }

  return '';
}

export async function verifyPartAFields(
  page: Page,
  expected: PartAExpected,
): Promise<void> {
  const mismatches: string[] = [];

  const taxpayer = await readSelectValue(page, selectors.partA.taxpayerDropdown);
  if (taxpayer && !taxpayer.toLowerCase().includes(expected.taxpayerType.toLowerCase())) {
    mismatches.push(`taxpayer: expected "${expected.taxpayerType}", got "${taxpayer}"`);
  } else if (!taxpayer) {
    mismatches.push('taxpayer: not selected');
  }

  const state = await readSelectValue(page, selectors.partA.stateDropdown);
  if (!state.toLowerCase().includes(expected.state.toLowerCase())) {
    mismatches.push(`state: expected "${expected.state}", got "${state || 'empty'}"`);
  }

  const district = await readSelectValue(page, selectors.partA.districtDropdown);
  const districtOk =
    district &&
    (district.toLowerCase().includes(expected.district.toLowerCase()) ||
      expected.district.toLowerCase().includes(district.toLowerCase()));
  if (!districtOk) {
    mismatches.push(`district: expected "${expected.district}", got "${district || 'empty'}"`);
  }

  const legalName = await readInputValue(
    page,
    selectors.partA.legalName,
    selectors.partA.fieldLabels.legalName,
  );
  if (legalName.trim() !== expected.legalName.trim()) {
    mismatches.push(`legalName: expected "${expected.legalName}", got "${legalName}"`);
  }

  const pan = await readInputValue(page, selectors.partA.pan, selectors.partA.fieldLabels.pan);
  if (pan.trim().toUpperCase() !== expected.pan.trim().toUpperCase()) {
    mismatches.push(`pan: expected "${expected.pan}", got "${pan}"`);
  }

  const email = await readInputValue(
    page,
    selectors.partA.email,
    selectors.partA.fieldLabels.email,
  );
  if (email.trim().toLowerCase() !== expected.pasEmail.trim().toLowerCase()) {
    mismatches.push(`email: expected "${expected.pasEmail}", got "${email}"`);
  }

  const mobileRaw = await readInputValue(
    page,
    selectors.partA.mobile,
    selectors.partA.fieldLabels.mobile,
  );
  const mobile = mobileRaw.replace(/\D/g, '').slice(-10);
  const expectedMobile = expected.pasMobile.replace(/\D/g, '').slice(-10);
  if (mobile !== expectedMobile) {
    mismatches.push(`mobile: expected "${expected.pasMobile}", got "${mobileRaw}"`);
  }

  if (mismatches.length) {
    throw new Error(`Part A field verification failed:\n- ${mismatches.join('\n- ')}`);
  }
}

export function toPartAExpected(partA: ApplicationFormData['partA']): PartAExpected {
  return {
    taxpayerType: partA.taxpayerType,
    state: partA.state,
    district: partA.district,
    legalName: partA.legalName,
    pan: partA.pan,
    pasEmail: partA.pasEmail,
    pasMobile: partA.pasMobile,
  };
}
