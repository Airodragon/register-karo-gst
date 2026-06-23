import type { Page } from 'playwright';
import type { ApplicationFormData } from '@registerkaro/shared-types';
import { selectors } from '../selectors';
import type { ApiClient } from '../api-client';
import { saveSession } from '../session/context-manager';
import { fillInputByLabel } from '../form-utils';
import type { ResolvedDocuments } from '../document-resolver';
import {
  addHsnCode,
  addSacCode,
  addressFromPerson,
  clickContinue,
  clickTab,
  dismissModals,
  fillByLabel,
  fillPortalAddress,
  fillPromoterPasToggle,
  fillSplitNameFields,
  fillVerificationTab,
  isTabComplete,
  reasonRegistrationCandidates,
  resolveJurisdictionDropdowns,
  saveAndContinue,
  selectAadhaarPerson,
  selectByScope,
  selectGender,
  setPortalToggle,
  splitFullName,
  toPortalDate,
  uploadPortalDocument,
} from './part-b-portal';

type TabRunner = () => Promise<void>;

async function runTabIfNeeded(
  page: Page,
  tabName: string,
  runner: TabRunner,
): Promise<void> {
  if (await isTabComplete(page, tabName)) return;
  await runner();
}

async function persistTab(
  page: Page,
  api: ApiClient,
  applicationId: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const session = await saveSession(page);
  await api.updateApplication(applicationId, { portalSession: session, ...extra });
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
    'select[name*="constitution"], select[id*="constitution"]',
    business.constitutionOfBusiness,
  );
  await selectByScope(
    page,
    'select[name*="district"], select[id*="district"], select[id*="Distr"]',
    business.district,
  );

  if (!business.casualTaxpayer) {
    await setPortalToggle(page, /casual taxable person/i, false);
  }
  if (!business.compositionLevy) {
    await setPortalToggle(page, /Composition/i, false);
  }

  if (business.rule14A) {
    await setPortalToggle(page, /Rule 14A/i, true);
  } else {
    await page.getByText(/Rule 14A/i).locator('..').getByText('No').first().click().catch(() => {});
  }

  for (const reason of reasonRegistrationCandidates(business.reasonForRegistration)) {
    const ok = await page
      .locator('select[name*="reason"], select[id*="reason"]')
      .first()
      .selectOption({ label: reason })
      .then(() => true)
      .catch(() => false);
    if (ok) break;
  }

  await fillByLabel(page, /commencement/i, toPortalDate(business.commencementDate));
  await fillByLabel(page, /liability/i, toPortalDate(business.liabilityDate));

  await saveAndContinue(page);
  await persistTab(page, api, applicationId);
}

export async function fillPromoterDetails(
  page: Page,
  promoter: ApplicationFormData['promoter'],
  docs: ResolvedDocuments,
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'promoter_details');
  await api.updateApplication(applicationId, { currentStep: 'PEOPLE' });
  await clickTab(page, selectors.partB.tabs.promoters);

  await fillByLabel(page, /^First Name/i, promoter.firstName);
  if (promoter.middleName) {
    await fillByLabel(page, /Middle Name/i, promoter.middleName);
  }
  await fillByLabel(page, /^Last Name/i, promoter.lastName);

  const father = splitFullName(promoter.fatherName);
  await fillSplitNameFields(page, /Name of Father/i, father.first, father.middle, father.last);

  await fillByLabel(page, /Date of Birth/i, toPortalDate(promoter.dateOfBirth));
  await fillByLabel(page, /Mobile/i, promoter.mobile);
  await fillByLabel(page, /Email/i, promoter.email);
  await selectGender(page, promoter.gender);
  await fillByLabel(page, /Designation/i, promoter.designation);
  await fillInputByLabel(page, [/Permanent Account Number/i], promoter.pan);

  const addr = addressFromPerson(promoter.residentialAddress);
  await fillPortalAddress(page, addr);

  if (docs.promoterPhoto) {
    await uploadPortalDocument(page, /Photo/i, docs.promoterPhoto);
  }

  if (promoter.isPrimaryAuthorizedSignatory) {
    await fillPromoterPasToggle(page, true);
  }

  await saveAndContinue(page);
  await dismissModals(page);
  await persistTab(page, api, applicationId);
}

export async function fillAuthorizedSignatoryTab(
  page: Page,
  promoter: ApplicationFormData['promoter'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await clickTab(page, selectors.partB.tabs.authorizedSignatory);
  if (promoter.isPrimaryAuthorizedSignatory) {
    await page.getByText(/Primary Authorized Signatory/i).first().click().catch(() => {});
  }
  await saveAndContinue(page);
  await persistTab(page, api, applicationId);
}

export async function fillAuthorizedRepresentative(
  page: Page,
  place: ApplicationFormData['principalPlaceOfBusiness'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'authorized_rep');
  await clickTab(page, selectors.partB.tabs.authorizedRepresentative);
  const hasRep = place.hasAuthorizedRepresentative ?? false;
  await setPortalToggle(page, /Authorized Representative/i, hasRep);
  await saveAndContinue(page);
  await persistTab(page, api, applicationId);
}

export async function fillPrincipalPlace(
  page: Page,
  place: ApplicationFormData['principalPlaceOfBusiness'],
  docs: ResolvedDocuments,
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'place_of_business');
  await api.updateApplication(applicationId, { currentStep: 'PLACE_OF_BUSINESS' });
  await clickTab(page, selectors.partB.tabs.principalPlace);

  await fillPortalAddress(page, {
    pincode: place.pincode,
    locality: place.locality ?? place.city,
    street: place.street,
    building: place.building,
    city: place.city,
    floorNo: place.floorNo,
    flatNo: place.flatNo,
    landmark: place.landmark,
  });

  const jurisdiction = await resolveJurisdictionDropdowns(page, place.jurisdiction);
  await api.reportProgress(applicationId, 'place_of_business', undefined, {
    jurisdictionOptions: jurisdiction.options,
    jurisdictionSelected: jurisdiction.selected,
  });

  await fillByLabel(page, /Office Email|Email/i, place.email);
  await fillByLabel(page, /Mobile/i, place.mobile);

  await selectByScope(
    page,
    'select[name*="possession"], select[id*="possession"]',
    place.natureOfPossession,
  );

  if (docs.addressProof) {
    await uploadPortalDocument(page, /Municipal|Khata|Address|Proof/i, docs.addressProof);
  }

  for (const activity of place.businessActivities) {
    await page.getByLabel(activity).check().catch(() => page.getByText(activity).first().click());
  }

  const hasAdditional = place.hasAdditionalPlaces ?? false;
  await setPortalToggle(page, /Additional Place/i, hasAdditional);

  await saveAndContinue(page);
  await dismissModals(page);
  await persistTab(page, api, applicationId);
}

export async function fillAdditionalPlaces(page: Page): Promise<void> {
  await clickTab(page, selectors.partB.tabs.additionalPlaces);
  await clickContinue(page);
}

export async function fillGoodsAndServices(
  page: Page,
  goods: ApplicationFormData['goodsAndServices'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'goods_services');
  await api.updateApplication(applicationId, { currentStep: 'GOODS_SERVICES' });
  await clickTab(page, selectors.partB.tabs.goods);

  const goodsTab = page.getByText('Goods', { exact: true }).first();
  if (await goodsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await goodsTab.click();
  }

  for (const hsn of goods.hsnCodes) {
    await addHsnCode(page, hsn);
  }
  for (const sac of goods.sacCodes) {
    await addSacCode(page, sac);
  }

  await saveAndContinue(page);
  await persistTab(page, api, applicationId);
}

export async function fillStateSpecific(
  page: Page,
  stateSpecific: ApplicationFormData['stateSpecific'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'state_specific');
  await clickTab(page, selectors.partB.tabs.stateSpecific);

  if (stateSpecific?.professionalTaxEcNo) {
    await fillByLabel(page, /Professional Tax.*EC|E\.C/i, stateSpecific.professionalTaxEcNo);
  }
  if (stateSpecific?.professionalTaxRcNo) {
    await fillByLabel(page, /Professional Tax.*RC|R\.C/i, stateSpecific.professionalTaxRcNo);
  }
  if (stateSpecific?.stateExciseLicenseNo) {
    await fillByLabel(page, /Excise License/i, stateSpecific.stateExciseLicenseNo);
  }

  await saveAndContinue(page);
  await persistTab(page, api, applicationId, { currentStep: 'REVIEW_SUBMIT' });
}

export async function fillAadhaarTab(
  page: Page,
  aadhaar: ApplicationFormData['aadhaarAuthentication'],
  promoter: ApplicationFormData['promoter'],
  api: ApiClient,
  applicationId: string,
): Promise<void> {
  await api.reportProgress(applicationId, 'aadhaar_tab');
  await clickTab(page, selectors.partB.tabs.aadhaar);

  if (aadhaar.optIn) {
    await setPortalToggle(page, /opt for Aadhaar Authentication/i, true);
    const name = new RegExp(promoter.firstName, 'i');
    await selectAadhaarPerson(page, name);
  }

  await saveAndContinue(page);
  await dismissModals(page);

  await api.updateApplication(applicationId, {
    status: 'PART_B_SAVED',
    currentStep: 'REVIEW_SUBMIT',
  });
  await persistTab(page, api, applicationId);
}

export async function runPartB(
  page: Page,
  formData: ApplicationFormData,
  api: ApiClient,
  applicationId: string,
  docs: ResolvedDocuments,
  constitution?: string,
): Promise<void> {
  void constitution;

  await runTabIfNeeded(page, selectors.partB.tabs.businessDetails, () =>
    fillBusinessDetails(page, formData.business, api, applicationId),
  );

  await runTabIfNeeded(page, selectors.partB.tabs.promoters, () =>
    fillPromoterDetails(page, formData.promoter, docs, api, applicationId),
  );

  await runTabIfNeeded(page, selectors.partB.tabs.authorizedSignatory, () =>
    fillAuthorizedSignatoryTab(page, formData.promoter, api, applicationId),
  );

  await runTabIfNeeded(page, selectors.partB.tabs.authorizedRepresentative, () =>
    fillAuthorizedRepresentative(page, formData.principalPlaceOfBusiness, api, applicationId),
  );

  await runTabIfNeeded(page, selectors.partB.tabs.principalPlace, () =>
    fillPrincipalPlace(page, formData.principalPlaceOfBusiness, docs, api, applicationId),
  );

  if (!(await isTabComplete(page, selectors.partB.tabs.additionalPlaces))) {
    await fillAdditionalPlaces(page);
  }

  await runTabIfNeeded(page, selectors.partB.tabs.goods, () =>
    fillGoodsAndServices(page, formData.goodsAndServices, api, applicationId),
  );

  await runTabIfNeeded(page, selectors.partB.tabs.stateSpecific, () =>
    fillStateSpecific(page, formData.stateSpecific, api, applicationId),
  );

  await runTabIfNeeded(page, selectors.partB.tabs.aadhaar, () =>
    fillAadhaarTab(page, formData.aadhaarAuthentication, formData.promoter, api, applicationId),
  );
}

export { fillVerificationTab };
