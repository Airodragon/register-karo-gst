import type { Page } from 'playwright';
import type { ApplicationFormData } from '@registerkaro/shared-types';
import { selectors } from '../selectors';
import type { ApiClient } from '../api-client';
import { saveSession } from '../session/context-manager';
import { fillInputByLabel } from '../form-utils';

function toPortalDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

async function clickTab(page: Page, tabName: string): Promise<void> {
  const tab = page
    .locator(`li:has-text("${tabName}"), a:has-text("${tabName}")`)
    .first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  await tab.click();
  await page.waitForTimeout(1500);
}

async function saveAndContinue(page: Page): Promise<void> {
  await page.locator(selectors.partB.saveContinue).first().click();
  await page.waitForTimeout(2000);
}

async function fillByLabel(page: Page, label: RegExp, value: string): Promise<void> {
  const field = page.getByLabel(label).first();
  if (await field.count()) {
    await field.fill(value);
    return;
  }
  await page.locator(`input[placeholder*="${label.source}"]`).first().fill(value).catch(() => {});
}

async function selectByScope(
  page: Page,
  scopeSelector: string,
  label: string,
): Promise<void> {
  const select = page.locator(scopeSelector).first();
  if (await select.count()) {
    await select.selectOption({ label }).catch(() => {});
  }
}

export async function fillBusinessDetails(
  page: Page,
  business: ApplicationFormData['business'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'business_details');
  await api.updateApplication(applicationId, {
    status: 'PART_B_IN_PROGRESS',
    currentStep: 'BUSINESS',
  });

  await clickTab(page, selectors.partB.tabs.businessDetails);

  await fillByLabel(page, /Trade Name/i, business.tradeName);
  await selectByScope(
    page,
    'select[name*="constitutionOfBusiness"], select[id*="constitution"]',
    business.constitutionOfBusiness,
  );
  await fillByLabel(page, /commencement/i, toPortalDate(business.commencementDate));
  await fillByLabel(page, /liability/i, toPortalDate(business.liabilityDate));

  if (!business.compositionLevy) {
    await page.getByLabel(/Composition/i).locator('..').getByText('No').click().catch(() => {});
  }
  if (!business.casualTaxpayer) {
    await page
      .getByText(/casual taxable person/i)
      .locator('..')
      .getByText('No')
      .click()
      .catch(() => {});
  }

  await selectByScope(
    page,
    'select[name*="reason"], select[id*="reason"]',
    business.reasonForRegistration,
  );

  await saveAndContinue(page);
  const session = await saveSession(page);
  await api.updateApplication(applicationId, { portalSession: session });
}

export async function fillPromoterDetails(
  page: Page,
  promoter: ApplicationFormData['promoter'],
  documents: ApplicationFormData['documents'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'promoter_details');
  await api.updateApplication(applicationId, { currentStep: 'PEOPLE' });
  await clickTab(page, selectors.partB.tabs.promoters);

  await fillByLabel(page, /First Name/i, promoter.firstName);
  await fillByLabel(page, /Last Name/i, promoter.lastName);
  await fillByLabel(page, /Father/i, promoter.fatherName);
  if (promoter.dateOfBirth) {
    await fillByLabel(page, /Date of Birth|DOB/i, toPortalDate(promoter.dateOfBirth));
  }
  await fillInputByLabel(page, [/Permanent Account Number/i], promoter.pan);
  await fillByLabel(page, /Mobile/i, promoter.mobile);
  await fillByLabel(page, /Email/i, promoter.email);

  if (documents?.promoterPhoto) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      // Document path resolved by worker from local cache if downloaded from S3
    }
  }

  await saveAndContinue(page);

  await clickTab(page, selectors.partB.tabs.authorizedSignatory);
  if (promoter.isPrimaryAuthorizedSignatory) {
    await page.getByText(/Primary Authorized Signatory/i).click().catch(() => {});
  }
  await saveAndContinue(page);

  const session = await saveSession(page);
  await api.updateApplication(applicationId, { portalSession: session });
}

export async function fillPrincipalPlace(
  page: Page,
  place: ApplicationFormData['principalPlaceOfBusiness'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'place_of_business');
  await api.updateApplication(applicationId, { currentStep: 'PLACE_OF_BUSINESS' });
  await clickTab(page, selectors.partB.tabs.principalPlace);

  await fillByLabel(page, /Building/i, place.building);
  await fillByLabel(page, /Street/i, place.street);
  await fillByLabel(page, /City|Locality/i, place.city);
  await fillByLabel(page, /PIN|Pincode/i, place.pincode);
  await fillByLabel(page, /Email/i, place.email);
  await fillByLabel(page, /Mobile/i, place.mobile);

  await selectByScope(
    page,
    'select[name*="possession"], select[id*="possession"]',
    place.natureOfPossession,
  );

  for (const activity of place.businessActivities) {
    await page.getByLabel(activity).check().catch(() => {
      page.getByText(activity).click();
    });
  }

  await saveAndContinue(page);
  const session = await saveSession(page);
  await api.updateApplication(applicationId, { portalSession: session });
}

export async function fillGoodsAndServices(
  page: Page,
  goods: ApplicationFormData['goodsAndServices'],
  stateSpecific: ApplicationFormData['stateSpecific'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'goods_services');
  await api.updateApplication(applicationId, { currentStep: 'GOODS_SERVICES' });
  await clickTab(page, selectors.partB.tabs.goods);

  for (const hsn of goods.hsnCodes) {
    const search = page.getByPlaceholder(/HSN/i).first();
    if (await search.count()) {
      await search.fill(hsn);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
  }

  for (const sac of goods.sacCodes) {
    const search = page.getByPlaceholder(/SAC|Service/i).first();
    if (await search.count()) {
      await search.fill(sac);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
  }

  await saveAndContinue(page);

  const hasStateSpecific =
    !!stateSpecific?.caNumber ||
    !!stateSpecific?.electricityBoard ||
    !!stateSpecific?.professionalTaxEcNo ||
    !!stateSpecific?.professionalTaxRcNo;

  if (hasStateSpecific) {
    await clickTab(page, selectors.partB.tabs.stateSpecific);
    if (stateSpecific?.caNumber) {
      await fillByLabel(page, /CA Number|Consumer/i, stateSpecific.caNumber);
    }
    if (stateSpecific?.electricityBoard) {
      await selectByScope(
        page,
        'select[name*="electricity"], select[id*="electricity"], select[name*="board"]',
        stateSpecific.electricityBoard,
      );
    }
    if (stateSpecific?.professionalTaxEcNo) {
      await fillByLabel(page, /Professional Tax.*EC|EC No/i, stateSpecific.professionalTaxEcNo);
    }
    if (stateSpecific?.professionalTaxRcNo) {
      await fillByLabel(page, /Professional Tax.*RC|RC No/i, stateSpecific.professionalTaxRcNo);
    }
    await saveAndContinue(page);
  }

  const session = await saveSession(page);
  await api.updateApplication(applicationId, { portalSession: session, currentStep: 'REVIEW_SUBMIT' });
}

export async function fillAadhaarAndVerification(
  page: Page,
  aadhaar: ApplicationFormData['aadhaarAuthentication'],
  verification: ApplicationFormData['verification'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'aadhaar_tab');
  await clickTab(page, selectors.partB.tabs.aadhaar);

  if (aadhaar.optIn) {
    const aadhaarToggle = page
      .locator('text=Do you want to opt for Aadhaar Authentication')
      .locator('..');
    await aadhaarToggle
      .getByText('Yes')
      .click()
      .catch(async () => {
        await page.locator('label:has-text("Yes")').first().click();
      });
  }

  await saveAndContinue(page);

  await clickTab(page, selectors.partB.tabs.verification);
  await page.getByRole('checkbox').first().check().catch(() => {});
  await fillByLabel(page, /Place/i, verification.place);

  const session = await saveSession(page);
  await api.updateApplication(applicationId, {
    portalSession: session,
    status: 'PART_B_SAVED',
  });
}

export async function runPartB(
  page: Page,
  formData: ApplicationFormData,
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await fillBusinessDetails(page, formData.business, api, applicationId);
  await fillPromoterDetails(page, formData.promoter, formData.documents, api, applicationId);
  await fillPrincipalPlace(page, formData.principalPlaceOfBusiness, api, applicationId);
  await fillGoodsAndServices(
    page,
    formData.goodsAndServices,
    formData.stateSpecific,
    api,
    applicationId,
  );
  await fillAadhaarAndVerification(
    page,
    formData.aadhaarAuthentication,
    formData.verification,
    api,
    applicationId,
  );
}
