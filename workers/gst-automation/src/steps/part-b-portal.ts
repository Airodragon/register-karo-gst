import type { Locator, Page } from 'playwright';
import type { Address, JurisdictionData } from '@registerkaro/shared-types';
import { selectors } from '../selectors';
import { safeWait, isOnPartBDashboard } from '../page-utils';
import { fillInputByLabel } from '../form-utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface JurisdictionSnapshot {
  options: Record<string, string[]>;
  selected: Record<string, string>;
}

export function toPortalDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function splitFullName(full: string): { first: string; middle: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', middle: '', last: '' };
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

const REASON_ALIASES: Record<string, string[]> = {
  'Crossing the threshold': ['Crossing the threshold', 'Voluntary Basis'],
  'Voluntary Basis': ['Voluntary Basis'],
};

export function reasonRegistrationCandidates(reason: string): string[] {
  return REASON_ALIASES[reason] ?? [reason];
}

export async function clickTab(page: Page, tabName: string): Promise<void> {
  const tab = page.locator(`li:has-text("${tabName}"), a:has-text("${tabName}")`).first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  await tab.click();
  await safeWait(page, 1500);
}

export async function isTabComplete(page: Page, tabName: string): Promise<boolean> {
  const tab = page.locator(`li:has-text("${tabName}")`).first();
  if (!(await tab.count())) return false;
  const html = (await tab.innerHTML().catch(() => '')) ?? '';
  return /fa-check|check-circle|glyphicon-ok|completed/i.test(html);
}

export async function dismissModals(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const yesBtn = page.locator(selectors.partB.modalYes).first();
    if (await yesBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await yesBtn.click();
      await safeWait(page, 1000);
      continue;
    }
    const okBtn = page.locator(selectors.partB.modalOk).first();
    if (await okBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await okBtn.click();
      await safeWait(page, 1000);
      continue;
    }
    break;
  }
}

export async function saveAndContinue(page: Page): Promise<void> {
  const btn = page.locator(selectors.partB.saveContinue).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await safeWait(page, 2000);
  await dismissModals(page);
}

export async function clickContinue(page: Page): Promise<void> {
  const btn = page.locator(selectors.partB.continueButton).first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await safeWait(page, 2000);
}

export async function setPortalToggle(page: Page, labelPattern: RegExp, yes: boolean): Promise<void> {
  const section = page.getByText(labelPattern).first();
  if (!(await section.count())) return;
  const container = section.locator('xpath=ancestor::div[contains(@class,"form") or contains(@class,"row")][1]').first();
  const target = yes ? 'Yes' : 'No';
  const toggle = container.getByText(target, { exact: true }).first();
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await toggle.click();
    await safeWait(page, 400);
    return;
  }
  await section.locator('..').getByText(target, { exact: true }).first().click().catch(() => {});
  await safeWait(page, 400);
}

export async function fillByLabel(page: Page, label: RegExp, value: string): Promise<void> {
  if (!value) return;
  const field = page.getByLabel(label, { exact: false }).first();
  if (await field.count()) {
    await field.fill(value);
    return;
  }
  await page.locator(`input[placeholder*="${label.source}" i]`).first().fill(value).catch(() => {});
}

export async function fillSplitNameFields(
  page: Page,
  sectionLabel: RegExp,
  first: string,
  middle: string,
  last: string,
): Promise<void> {
  const section = page.getByText(sectionLabel).first();
  const scope = (await section.count())
    ? section.locator('xpath=ancestor::div[contains(@class,"form") or contains(@class,"panel")][1]')
    : page;

  const firstField = scope.getByLabel(/^First Name/i).first();
  if (await firstField.count()) await firstField.fill(first);
  const middleField = scope.getByLabel(/^Middle Name/i).first();
  if (await middleField.count()) await middleField.fill(middle);
  const lastField = scope.getByLabel(/^Last Name/i).first();
  if (await lastField.count()) await lastField.fill(last);
}

export async function selectGender(page: Page, gender: string): Promise<void> {
  await page.getByLabel(gender, { exact: true }).first().check().catch(async () => {
    await page.getByText(gender, { exact: true }).first().click();
  });
}

export async function readSelectOptions(select: Locator): Promise<SelectOption[]> {
  return select.locator('option').evaluateAll((els) =>
    els
      .map((el) => ({
        value: (el as HTMLOptionElement).value,
        label: (el.textContent ?? '').trim(),
      }))
      .filter((o) => {
        const lower = o.label.toLowerCase();
        return Boolean(o.value) && o.label && lower !== 'select' && lower !== 'choose';
      }),
  );
}

function fuzzyMatchOption(options: SelectOption[], preferred?: string): SelectOption | null {
  if (!preferred) return options[0] ?? null;
  const norm = preferred.toLowerCase().replace(/\s+/g, ' ');
  return (
    options.find((o) => o.label.toLowerCase() === norm) ??
    options.find((o) => o.label.toLowerCase().includes(norm)) ??
    options.find((o) => norm.includes(o.label.toLowerCase())) ??
    options[0] ??
    null
  );
}

export async function waitForSelectOptions(
  select: Locator,
  timeoutMs = 15000,
): Promise<SelectOption[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const options = await readSelectOptions(select);
    if (options.length > 0) return options;
    await safeWait(select.page(), 400);
  }
  return [];
}

export async function selectPortalDropdown(
  page: Page,
  labelPattern: RegExp,
  preferred?: string,
): Promise<{ options: string[]; selected: string }> {
  const label = page.getByText(labelPattern).first();
  let select = page.locator(`select:near(:text("${labelPattern.source}"))`).first();
  if (!(await select.count())) {
    const row = label.locator('xpath=ancestor::div[contains(@class,"form-group") or contains(@class,"row")][1]');
    select = row.locator('select').first();
  }
  if (!(await select.count())) {
    select = page.locator('select').filter({ has: page.locator('option') }).first();
  }

  const options = await waitForSelectOptions(select);
  const pick = fuzzyMatchOption(options, preferred);
  if (!pick) {
    return { options: options.map((o) => o.label), selected: '' };
  }
  await select.selectOption(pick.value);
  await safeWait(page, 800);
  return { options: options.map((o) => o.label), selected: pick.label };
}

export async function selectAutocomplete(page: Page, labelPattern: RegExp, query: string): Promise<void> {
  if (!query) return;
  const field = page.getByLabel(labelPattern, { exact: false }).first();
  if (await field.count()) {
    await field.fill(query);
    await safeWait(page, 1200);
    const suggestion = page
      .locator('[role="option"], .ui-menu-item, .autocomplete-suggestion, li')
      .filter({ hasText: new RegExp(query.split(' ')[0], 'i') })
      .first();
    if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
      await suggestion.click();
      await safeWait(page, 800);
    } else {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await safeWait(page, 500);
    }
  }
}

export interface PortalAddressInput {
  pincode: string;
  locality?: string;
  street: string;
  building: string;
  city: string;
  floorNo?: string;
  flatNo?: string;
  landmark?: string;
}

export async function fillPortalAddress(page: Page, address: PortalAddressInput): Promise<void> {
  await fillByLabel(page, /PIN|Pincode/i, address.pincode);
  await safeWait(page, 1500);

  const localityQuery = address.locality ?? address.city;
  await selectAutocomplete(page, /Locality|Sub Locality/i, localityQuery);

  await fillByLabel(page, /Road|Street/i, address.street);
  await fillByLabel(page, /Premises|Building/i, address.building);
  await fillByLabel(page, /City|Town|Village/i, address.city);
  if (address.flatNo) {
    await fillByLabel(page, /Building No|Flat No|Door No/i, address.flatNo);
  }
  if (address.floorNo) {
    await fillByLabel(page, /Floor/i, address.floorNo);
  }
  if (address.landmark) {
    await fillByLabel(page, /Landmark/i, address.landmark);
  }
}

export async function resolveJurisdictionDropdowns(
  page: Page,
  jurisdiction?: JurisdictionData,
): Promise<JurisdictionSnapshot> {
  const snapshot: JurisdictionSnapshot = { options: {}, selected: {} };

  const fields: Array<{ key: keyof JurisdictionData; pattern: RegExp }> = [
    { key: 'ward', pattern: selectors.partB.jurisdiction.ward },
    { key: 'commissionerate', pattern: selectors.partB.jurisdiction.commissionerate },
    { key: 'division', pattern: selectors.partB.jurisdiction.division },
    { key: 'range', pattern: selectors.partB.jurisdiction.range },
  ];

  for (const { key, pattern } of fields) {
    const result = await selectPortalDropdown(page, pattern, jurisdiction?.[key]);
    snapshot.options[key] = result.options;
    snapshot.selected[key] = result.selected;
    await safeWait(page, 1000);
  }

  return snapshot;
}

export async function uploadPortalDocument(
  page: Page,
  labelPattern: RegExp,
  filePath: string,
): Promise<void> {
  const section = page.getByText(labelPattern).first();
  const scope = (await section.count())
    ? section.locator('xpath=ancestor::div[3]')
    : page.locator('body');
  const fileInput = scope.locator('input[type="file"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(filePath);
    await safeWait(page, 2000);
    return;
  }
  const fallback = page.locator('input[type="file"]').first();
  if (await fallback.count()) {
    await fallback.setInputFiles(filePath);
    await safeWait(page, 2000);
  }
}

export async function addHsnCode(page: Page, code: string): Promise<void> {
  const search = page.getByPlaceholder(/HSN/i).first();
  if (!(await search.count())) return;
  await search.fill(code);
  await safeWait(page, 1200);
  const row = page.locator('li, [role="option"], tr').filter({ hasText: code }).first();
  if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
    await row.click();
  } else {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  }
  await safeWait(page, 800);
}

export async function addSacCode(page: Page, code: string): Promise<void> {
  const servicesTab = page.getByText('Services', { exact: true }).first();
  if (await servicesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await servicesTab.click();
    await safeWait(page, 800);
  }
  const search = page.getByPlaceholder(/SAC|Service/i).first();
  if (!(await search.count())) return;
  await search.fill(code);
  await safeWait(page, 1200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await safeWait(page, 800);
}

export async function selectByScope(
  page: Page,
  scopeSelector: string,
  label: string,
): Promise<void> {
  const select = page.locator(scopeSelector).first();
  if (await select.count()) {
    await select.selectOption({ label }).catch(async () => {
      const options = await readSelectOptions(select);
      const pick = fuzzyMatchOption(options, label);
      if (pick) await select.selectOption(pick.value);
    });
  }
}

export async function fillPromoterPasToggle(page: Page, yes: boolean): Promise<void> {
  await setPortalToggle(page, /Also Authorized Signatory/i, yes);
}

export async function selectAadhaarPerson(page: Page, namePattern: RegExp): Promise<void> {
  const row = page.locator('tr').filter({ hasText: namePattern }).first();
  if (await row.count()) {
    await row.locator('input[type="checkbox"]').first().check().catch(async () => {
      await row.getByRole('checkbox').first().click();
    });
  }
}

export async function fillVerificationTab(
  page: Page,
  signatoryName: string,
  place: string,
): Promise<void> {
  await page.getByRole('checkbox').first().check().catch(() => {});
  const signatorySelect = page.getByLabel(/Name of Authorized Signatory/i).first();
  if (await signatorySelect.count()) {
    await signatorySelect.selectOption({ label: signatoryName }).catch(async () => {
      const options = await readSelectOptions(signatorySelect);
      const pick =
        options.find((o) => o.label.toLowerCase().includes(signatoryName.split(' ')[0].toLowerCase())) ??
        options[1];
      if (pick) await signatorySelect.selectOption(pick.value);
    });
  }
  await fillByLabel(page, /^Place$/i, place);
}

export function addressFromPerson(addr: Address, place?: PortalAddressInput): PortalAddressInput {
  return {
    pincode: addr.pincode,
    locality: addr.locality ?? place?.locality,
    street: addr.street,
    building: addr.building,
    city: addr.city,
    floorNo: addr.floorNo ?? place?.floorNo,
    flatNo: addr.flatNo ?? place?.flatNo,
    landmark: addr.landmark ?? place?.landmark,
  };
}

export async function clickEditOnTrnRow(page: Page, trn: string): Promise<void> {
  const rowEdit = page.locator(selectors.partB.editRowByTrn(trn)).first();
  if (await rowEdit.isVisible({ timeout: 8000 }).catch(() => false)) {
    await rowEdit.click();
    await safeWait(page, 2500);
    return;
  }
  const editIcon = page.locator(selectors.partB.editIcon).first();
  if (await editIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editIcon.click();
    await safeWait(page, 2500);
  }
}

export async function waitForPartBForm(page: Page, trn: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isOnPartBDashboard(page)) return;

    const body = (await page.textContent('body').catch(() => '')) ?? '';
    if (body.includes(trn) || /My Applications|Edit/i.test(body)) {
      await clickEditOnTrnRow(page, trn);
      if (await isOnPartBDashboard(page)) return;
    }

    await safeWait(page, 1000);
  }

  throw new Error(
    'Could not open Part B form after TRN login. Click Edit on your application in the Chrome window, then resume.',
  );
}
