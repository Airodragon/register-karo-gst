import { isMultiPersonEntity } from '@/lib/wizard-steps';

export type WizardLocalState = {
  partA: Record<string, string>;
  business: Record<string, string | boolean>;
  promoter: Record<string, string>;
  promoterAddress: Record<string, string>;
  partner: Record<string, string>;
  partnerAddress: Record<string, string>;
  signatory: Record<string, string>;
  signatoryAddress: Record<string, string>;
  stateSpecific: Record<string, string>;
  place: Record<string, string | string[]>;
  goods: { hsnCodes?: string[]; sacCodes?: string[] };
  verification: Record<string, string>;
};

/** Split "MIHIR SRIVASTAVA" → first / last for promoter fields. */
export function splitLegalName(legalName: string): { firstName: string; lastName: string } {
  const parts = legalName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Propagate Part A (client) fields into later wizard steps so users don't re-enter
 * PAN, email, mobile, district, trade name, etc.
 */
export function applyPartASync(
  local: WizardLocalState,
  constitution?: string,
  options?: { placeSameAsResidential?: boolean },
): WizardLocalState {
  const { partA } = local;
  const nameParts = splitLegalName(partA.legalName ?? '');

  const promoter: Record<string, string> = {
    ...local.promoter,
    pan: partA.pan || local.promoter.pan,
    email: partA.pasEmail || local.promoter.email,
    mobile: partA.pasMobile || local.promoter.mobile,
    firstName: local.promoter.firstName || nameParts.firstName,
    lastName: local.promoter.lastName || nameParts.lastName,
  };

  const business: Record<string, string | boolean> = {
    ...local.business,
    tradeName: (local.business.tradeName as string) || partA.legalName || '',
    district: partA.district || (local.business.district as string) || '',
  };

  const place: Record<string, string | string[]> = {
    ...local.place,
    email: partA.pasEmail || (local.place.email as string) || '',
    mobile: partA.pasMobile || (local.place.mobile as string) || '',
    district: partA.district || (local.place.district as string) || '',
  };

  if (options?.placeSameAsResidential && !isMultiPersonEntity(constitution)) {
    if (local.promoterAddress.building) place.building = local.promoterAddress.building;
    if (local.promoterAddress.street) place.street = local.promoterAddress.street;
    if (local.promoterAddress.city) place.city = local.promoterAddress.city;
    if (local.promoterAddress.pincode) place.pincode = local.promoterAddress.pincode;
    if (local.promoterAddress.locality) place.locality = local.promoterAddress.locality;
    if (local.promoterAddress.landmark) place.landmark = local.promoterAddress.landmark;
    if (local.promoterAddress.floorNo) place.floorNo = local.promoterAddress.floorNo;
    if (local.promoterAddress.flatNo) place.flatNo = local.promoterAddress.flatNo;
  }

  const verification: Record<string, string> = {
    ...local.verification,
    place:
      local.verification.place ||
      local.promoterAddress.city ||
      (local.place.city as string) ||
      partA.district ||
      '',
  };

  const promoterAddress: Record<string, string> = {
    ...local.promoterAddress,
    state: local.promoterAddress.state || partA.state || '',
  };

  return {
    ...local,
    promoter,
    business,
    place,
    verification,
    promoterAddress,
  };
}

export function partAFieldChanged(
  local: WizardLocalState,
  field: string,
  value: string,
  constitution?: string,
  placeSameAsResidential?: boolean,
): WizardLocalState {
  const partA = { ...local.partA, [field]: value };
  let next: WizardLocalState = { ...local, partA };

  if (field === 'state') {
    next = {
      ...next,
      partA: { ...partA, district: '' },
      business: { ...next.business, district: '' },
      place: { ...next.place, district: '' },
      promoterAddress: { ...next.promoterAddress, state: value },
    };
  }

  if (field === 'district') {
    next = {
      ...next,
      business: { ...next.business, district: value },
      place: { ...next.place, district: value },
    };
  }

  return applyPartASync(next, constitution, { placeSameAsResidential });
}
