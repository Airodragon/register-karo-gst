'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApplicationStep } from '@registerkaro/shared-types';
import { FormField } from '@/components/form-field';
import { ReviewSummary } from '@/components/review-summary';
import { DocumentUpload } from '@/components/document-upload';
import { DocumentChecklist } from '@/components/document-checklist';
import { validateDocuments } from '@/lib/documents';
import {
  CONSTITUTION_OPTIONS,
  getDistrictsForState,
  INDIAN_STATES,
  NATURE_OF_POSSESSION_OPTIONS,
  REASON_FOR_REGISTRATION_OPTIONS,
} from '@/lib/india-locations';
import {
  validateWizardStep,
  WIZARD_STEPS,
  wizardStepIndex,
  constitutionToBusinessLabel,
  isMultiPersonEntity,
  type WizardStepId,
} from '@/lib/wizard-steps';
import { applyPartASync, partAFieldChanged, type WizardLocalState } from '@/lib/form-sync';
import { SyncedFieldsBanner } from '@/components/synced-fields-banner';
import clsx from 'clsx';

interface StepWizardProps {
  applicationId: string;
  constitution?: string;
  documents?: Array<{ id: string; type: string; fileName: string }>;
  formData: Record<string, unknown>;
  currentStep: string;
  onSave: (data: Record<string, unknown>, step: WizardStepId) => Promise<void>;
  onAutoSave?: (data: Record<string, unknown>) => Promise<void>;
  onStartAutomation: () => Promise<void>;
  onDocumentsChange?: () => void;
  onError?: (message: string) => void;
  readOnly?: boolean;
}

type LocalState = WizardLocalState;

function emptyLocal(formData: Record<string, unknown>, constitution?: string): LocalState {
  const partA = (formData.partA as Record<string, string>) ?? {};
  const business = (formData.business as Record<string, string | boolean>) ?? {};
  const promoter = (formData.promoter as Record<string, string>) ?? {};
  const promoterAddress =
    ((formData.promoter as Record<string, unknown> | undefined)?.residentialAddress as
      | Record<string, string>
      | undefined) ?? {};
  const partners = (formData.partners as Array<Record<string, unknown>> | undefined) ?? [];
  const firstPartner = partners[0] as Record<string, unknown> | undefined;
  const partner = (firstPartner as Record<string, string> | undefined) ?? {};
  const partnerAddress =
    (firstPartner?.residentialAddress as Record<string, string> | undefined) ?? {};
  const signatory = (formData.authorizedSignatory as Record<string, string>) ?? {};
  const signatoryAddress =
    ((formData.authorizedSignatory as Record<string, unknown> | undefined)?.residentialAddress as
      | Record<string, string>
      | undefined) ?? {};
  const stateSpecific = (formData.stateSpecific as Record<string, string>) ?? {};
  const place = (formData.principalPlaceOfBusiness as Record<string, string | string[]>) ?? {};
  const goods = (formData.goodsAndServices as { hsnCodes?: string[]; sacCodes?: string[] }) ?? {};
  const verification = (formData.verification as Record<string, string>) ?? {};
  const base = {
    partA,
    business,
    promoter,
    promoterAddress,
    partner,
    partnerAddress,
    signatory,
    signatoryAddress,
    stateSpecific,
    place,
    goods,
    verification,
  };
  return applyPartASync(base, constitution, { placeSameAsResidential: true });
}

function buildPayload(
  local: LocalState,
  formData: Record<string, unknown>,
  constitution?: string,
  placeSameAsResidential?: boolean,
) {
  const synced = applyPartASync(local, constitution, { placeSameAsResidential });
  const district = synced.partA.district || (synced.business.district as string);
  const businessConstitution =
    (synced.business.constitutionOfBusiness as string) ||
    constitutionToBusinessLabel(constitution);

  const promoterPayload = {
    isPrimaryAuthorizedSignatory: !isMultiPersonEntity(constitution),
    gender: synced.promoter.gender || 'Male',
    designation:
      synced.promoter.designation ||
      (constitution === 'partnership' ? 'Partner' : constitution === 'huf' ? 'Karta' : 'Proprietor'),
    ...synced.promoter,
    residentialAddress: {
      state: synced.promoterAddress.state || synced.partA.state,
      ...synced.promoterAddress,
    },
  };

  const partners =
    isMultiPersonEntity(constitution) && synced.partner.firstName
      ? [
          {
            gender: synced.partner.gender || 'Male',
            designation: synced.partner.designation || 'Partner',
            ...synced.partner,
            residentialAddress: {
              state: synced.partnerAddress.state || synced.partA.state,
              ...synced.partnerAddress,
            },
          },
        ]
      : undefined;

  const authorizedSignatory =
    isMultiPersonEntity(constitution) && synced.signatory.firstName
      ? {
          isPrimaryAuthorizedSignatory: true,
          gender: synced.signatory.gender || 'Male',
          designation: synced.signatory.designation || 'Authorized Signatory',
          ...synced.signatory,
          residentialAddress: {
            state: synced.signatoryAddress.state || synced.partA.state,
            ...synced.signatoryAddress,
          },
        }
      : undefined;

  return {
    ...formData,
    partA: { taxpayerType: 'Taxpayer', ...synced.partA },
    business: {
      compositionLevy: false,
      rule14A: false,
      casualTaxpayer: false,
      constitutionOfBusiness: businessConstitution,
      ...synced.business,
      district,
    },
    promoter: promoterPayload,
    partners,
    authorizedSignatory,
    stateSpecific: Object.keys(synced.stateSpecific).length ? synced.stateSpecific : undefined,
    principalPlaceOfBusiness: {
      businessActivities: ['Office / Sale Office'],
      ...synced.place,
      district,
    },
    goodsAndServices: {
      hsnCodes: synced.goods.hsnCodes?.filter(Boolean) ?? [],
      sacCodes: synced.goods.sacCodes?.filter(Boolean) ?? [],
    },
    aadhaarAuthentication: formData.aadhaarAuthentication ?? {
      optIn: true,
      selectedPersons: ['promoter'],
    },
    verification: { submissionMethod: 'EVC', ...synced.verification },
  };
}

function stepPayload(
  stepId: WizardStepId,
  local: LocalState,
  formData: Record<string, unknown>,
  constitution?: string,
  placeSameAsResidential?: boolean,
) {
  const full = buildPayload(local, formData, constitution, placeSameAsResidential);
  switch (stepId) {
    case ApplicationStep.CLIENT_PART_A:
      return full.partA;
    case ApplicationStep.BUSINESS:
      return full.business;
    case ApplicationStep.PEOPLE:
      return full.promoter;
    case ApplicationStep.PLACE_OF_BUSINESS:
      return full.principalPlaceOfBusiness;
    case ApplicationStep.GOODS_SERVICES:
      return full.goodsAndServices;
    case ApplicationStep.REVIEW_SUBMIT:
      return full.verification;
    default:
      return full;
  }
}

export function StepWizard({
  applicationId,
  constitution,
  documents = [],
  formData,
  currentStep,
  onSave,
  onAutoSave,
  onStartAutomation,
  onDocumentsChange,
  onError,
  readOnly,
}: StepWizardProps) {
  const [stepIndex, setStepIndex] = useState(() => wizardStepIndex(currentStep));
  const [local, setLocal] = useState<LocalState>(() => emptyLocal(formData, constitution));
  const [placeSameAsResidential, setPlaceSameAsResidential] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setLocal(emptyLocal(formData, constitution));
  }, [formData, constitution]);

  useEffect(() => {
    setStepIndex(wizardStepIndex(currentStep));
  }, [currentStep]);

  const autoSave = useCallback(async () => {
    if (readOnly || !onAutoSave) return;
    const full = buildPayload(local, formData, constitution, placeSameAsResidential);
    try {
      await onAutoSave(full);
    } catch {
      /* silent */
    }
  }, [local, formData, constitution, placeSameAsResidential, readOnly, onAutoSave]);

  useEffect(() => {
    if (readOnly) return;
    const timer = setTimeout(() => {
      void autoSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [local, autoSave, readOnly]);

  async function loadSampleData() {
    const res = await fetch('/fixtures/sample-proprietorship-filing.json');
    const sample = await res.json();
    setLocal(emptyLocal(sample.formData ?? sample, constitution));
    setPlaceSameAsResidential(true);
    setErrors([]);
  }

  const step = WIZARD_STEPS[stepIndex];
  const stateOptions = useMemo(
    () => INDIAN_STATES.map((s) => ({ value: s, label: s })),
    [],
  );
  const partADistricts = useMemo(
    () => getDistrictsForState(local.partA.state ?? ''),
    [local.partA.state],
  );
  const districtOptions = useMemo(
    () => partADistricts.map((d) => ({ value: d, label: d })),
    [partADistricts],
  );

  function updateSection<K extends keyof LocalState>(
    section: K,
    field: string,
    value: unknown,
  ) {
    setLocal((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as object), [field]: value },
    }));
    setErrors([]);
  }

  function updatePartA(field: string, value: string) {
    setLocal((prev) =>
      partAFieldChanged(prev, field, value, constitution, placeSameAsResidential),
    );
    setErrors([]);
  }

  function updatePromoterAddress(field: string, value: string) {
    setLocal((prev) => {
      const promoterAddress = { ...prev.promoterAddress, [field]: value };
      let next: LocalState = { ...prev, promoterAddress };
      if (placeSameAsResidential && !isMultiPersonEntity(constitution)) {
        next = applyPartASync(
          { ...next, place: { ...next.place, [field]: value } },
          constitution,
          { placeSameAsResidential: true },
        );
      }
      return applyPartASync(next, constitution, { placeSameAsResidential });
    });
    setErrors([]);
  }

  function handleStateChange(state: string) {
    updatePartA('state', state);
  }

  function togglePlaceSameAsResidential(checked: boolean) {
    setPlaceSameAsResidential(checked);
    setLocal((prev) =>
      applyPartASync(prev, constitution, { placeSameAsResidential: checked }),
    );
  }

  async function goNext() {
    const payload = stepPayload(step.id, local, formData, constitution, placeSameAsResidential);
    const result = validateWizardStep(step.id, payload);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    try {
      const full = buildPayload(local, formData, constitution, placeSameAsResidential);
      const nextStep = WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)];
      await onSave(full, nextStep.id);
      if (stepIndex < WIZARD_STEPS.length - 1) {
        setStepIndex(stepIndex + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  async function goBack() {
    if (stepIndex <= 0 || saving) return;
    const prevStep = WIZARD_STEPS[stepIndex - 1];
    setSaving(true);
    try {
      const full = buildPayload(local, formData, constitution, placeSameAsResidential);
      await onSave(full, prevStep.id);
      setStepIndex(stepIndex - 1);
      setErrors([]);
    } finally {
      setSaving(false);
    }
  }

  async function handleStart() {
    const payload = stepPayload(
      ApplicationStep.REVIEW_SUBMIT,
      local,
      formData,
      constitution,
      placeSameAsResidential,
    );
    const result = validateWizardStep(ApplicationStep.REVIEW_SUBMIT, payload);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    const full = buildPayload(local, formData, constitution, placeSameAsResidential);
    const docCheck = validateDocuments(
      (formData.documents as Record<string, string> | undefined),
      constitution,
    );
    if (!docCheck.valid) {
      setErrors([
        `Upload required documents before starting: ${docCheck.missing.join(', ')}`,
      ]);
      return;
    }
    setStarting(true);
    try {
      await onSave(full, ApplicationStep.REVIEW_SUBMIT);
      await onStartAutomation();
    } finally {
      setStarting(false);
    }
  }

  const fullPayload = buildPayload(local, formData, constitution, placeSameAsResidential);
  const multiPerson = isMultiPersonEntity(constitution);
  const syncedLocal = applyPartASync(local, constitution, { placeSameAsResidential });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < stepIndex && 'bg-teal-100 text-teal-800',
                i === stepIndex && 'bg-teal-700 text-white',
                i > stepIndex && 'bg-neutral-100 text-neutral-400',
              )}
            >
              {i + 1}
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={clsx(
                  'h-0.5 flex-1 rounded',
                  i < stepIndex ? 'bg-teal-400' : 'bg-neutral-200',
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{step.title}</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{step.subtitle}</p>
          </div>
          {!readOnly && stepIndex === 0 && (
            <button
              type="button"
              onClick={() => void loadSampleData()}
              className="text-xs font-medium text-teal-700 hover:underline shrink-0"
            >
              Load sample data
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Step {stepIndex + 1} of {WIZARD_STEPS.length}
          <span className="text-red-500 ml-2">* Required fields</span>
        </p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-60">
        {step.id === ApplicationStep.CLIENT_PART_A && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="legalName"
              label="Legal name"
              hint="Must match PAN records exactly."
              value={local.partA.legalName ?? ''}
              onChange={(v) => updatePartA('legalName', v)}
              required
            />
            <FormField
              id="pan"
              label="PAN"
              hint="10-character PAN of the business or proprietor."
              type="uppercase"
              value={local.partA.pan ?? ''}
              onChange={(v) => updatePartA('pan', v)}
              required
            />
            <FormField
              id="state"
              label="State / UT"
              hint="State where GST registration is applied."
              type="select"
              value={local.partA.state ?? ''}
              options={stateOptions}
              onChange={handleStateChange}
              required
            />
            <FormField
              id="district"
              label="District"
              hint="District of principal place of business."
              type="select"
              value={local.partA.district ?? ''}
              options={districtOptions}
              disabled={!local.partA.state}
              placeholder={local.partA.state ? 'Select district' : 'Select state first'}
              onChange={(v) => updatePartA('district', v)}
              required
            />
            <FormField
              id="pasEmail"
              label="PAS email"
              hint="Primary Authorized Signatory email for OTPs."
              type="email"
              value={local.partA.pasEmail ?? ''}
              onChange={(v) => updatePartA('pasEmail', v)}
              required
            />
            <FormField
              id="pasMobile"
              label="PAS mobile"
              hint="Indian mobile number for OTPs."
              type="tel"
              value={local.partA.pasMobile ?? ''}
              onChange={(v) =>
                updatePartA('pasMobile', v.replace(/\D/g, '').slice(0, 10))
              }
              required
            />
          </div>
        )}

        {step.id === ApplicationStep.BUSINESS && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SyncedFieldsBanner
              fields={[
                { label: 'District', value: syncedLocal.partA.district },
                { label: 'State', value: syncedLocal.partA.state },
              ]}
            />
            <FormField
              id="tradeName"
              label="Trade name"
              hint="Defaults to legal name from Step 1 — edit if you trade under a different name."
              value={(syncedLocal.business.tradeName as string) ?? ''}
              onChange={(v) => updateSection('business', 'tradeName', v)}
              required
            />
            <FormField
              id="constitution"
              label="Constitution"
              hint="Legal structure matching PAN records."
              type="select"
              value={(local.business.constitutionOfBusiness as string) ?? ''}
              options={CONSTITUTION_OPTIONS}
              onChange={(v) => updateSection('business', 'constitutionOfBusiness', v)}
              required
            />
            <FormField
              id="commencementDate"
              label="Commencement date"
              hint="When business operations started."
              type="date"
              value={(local.business.commencementDate as string) ?? ''}
              onChange={(v) => updateSection('business', 'commencementDate', v)}
              required
            />
            <FormField
              id="liabilityDate"
              label="Liability date"
              hint="When liable to register under GST."
              type="date"
              value={(local.business.liabilityDate as string) ?? ''}
              onChange={(v) => updateSection('business', 'liabilityDate', v)}
              required
            />
            <FormField
              id="reasonForRegistration"
              label="Reason for registration"
              hint="Why GST registration is being obtained."
              type="select"
              value={(local.business.reasonForRegistration as string) ?? ''}
              options={REASON_FOR_REGISTRATION_OPTIONS}
              onChange={(v) => updateSection('business', 'reasonForRegistration', v)}
              required
            />
            <div className="sm:col-span-2 border-t border-neutral-100 pt-4 mt-2">
              <p className="text-sm font-medium text-neutral-700 mb-3">State-specific (if applicable)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="caNumber"
                  label="CA number"
                  hint="Chartered Accountant registration number for some states."
                  value={local.stateSpecific.caNumber ?? ''}
                  onChange={(v) => updateSection('stateSpecific', 'caNumber', v)}
                />
                <FormField
                  id="electricityBoard"
                  label="Electricity board / consumer no."
                  hint="Electricity bill reference where required."
                  value={local.stateSpecific.electricityBoard ?? ''}
                  onChange={(v) => updateSection('stateSpecific', 'electricityBoard', v)}
                />
                <FormField
                  id="professionalTaxEcNo"
                  label="Professional tax EC no."
                  hint="Enrollment certificate number if applicable."
                  value={local.stateSpecific.professionalTaxEcNo ?? ''}
                  onChange={(v) => updateSection('stateSpecific', 'professionalTaxEcNo', v)}
                />
                <FormField
                  id="professionalTaxRcNo"
                  label="Professional tax RC no."
                  hint="Registration certificate number if applicable."
                  value={local.stateSpecific.professionalTaxRcNo ?? ''}
                  onChange={(v) => updateSection('stateSpecific', 'professionalTaxRcNo', v)}
                />
              </div>
            </div>
          </div>
        )}

        {step.id === ApplicationStep.PEOPLE && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SyncedFieldsBanner
              fields={[
                { label: 'PAN', value: syncedLocal.partA.pan },
                { label: 'Mobile', value: syncedLocal.partA.pasMobile },
                { label: 'Email', value: syncedLocal.partA.pasEmail },
              ]}
            />
            <p className="sm:col-span-2 text-sm font-medium text-neutral-800">
              {multiPerson
                ? constitution === 'huf'
                  ? 'Karta / primary member'
                  : 'Partner 1 (primary)'
                : 'Promoter / authorized signatory'}
            </p>
            <FormField
              id="firstName"
              label="First name"
              hint="Promoter's first name."
              value={local.promoter.firstName ?? ''}
              onChange={(v) => updateSection('promoter', 'firstName', v)}
              required
            />
            <FormField
              id="lastName"
              label="Last name"
              hint="Promoter's surname."
              value={local.promoter.lastName ?? ''}
              onChange={(v) => updateSection('promoter', 'lastName', v)}
              required
            />
            <FormField
              id="fatherName"
              label="Father's name"
              hint="As required on GST portal."
              value={local.promoter.fatherName ?? ''}
              onChange={(v) => updateSection('promoter', 'fatherName', v)}
              required
            />
            <FormField
              id="dateOfBirth"
              label="Date of birth"
              hint="Must align with Aadhaar."
              type="date"
              value={local.promoter.dateOfBirth ?? ''}
              onChange={(v) => updateSection('promoter', 'dateOfBirth', v)}
              required
            />
            {!multiPerson && (
              <p className="sm:col-span-2 text-xs text-neutral-500 -mt-2">
                Name fields are suggested from your legal name on Step 1 — adjust if needed.
              </p>
            )}
            <FormField
              id="gender"
              label="Gender"
              hint="As per official documents."
              type="select"
              value={local.promoter.gender ?? ''}
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' },
              ]}
              onChange={(v) => updateSection('promoter', 'gender', v)}
              required
            />
            <FormField
              id="designation"
              label="Designation"
              hint="e.g. Proprietor, Partner."
              value={local.promoter.designation ?? ''}
              onChange={(v) => updateSection('promoter', 'designation', v)}
              required
            />
            {multiPerson && (
              <>
                <FormField
                  id="promoterPan"
                  label="PAN"
                  hint="Promoter's PAN."
                  type="uppercase"
                  value={local.promoter.pan ?? ''}
                  onChange={(v) => updateSection('promoter', 'pan', v)}
                  required
                />
                <FormField
                  id="promoterMobile"
                  label="Mobile"
                  hint="Promoter's contact number."
                  type="tel"
                  value={local.promoter.mobile ?? ''}
                  onChange={(v) =>
                    updateSection('promoter', 'mobile', v.replace(/\D/g, '').slice(0, 10))
                  }
                  required
                />
                <FormField
                  id="promoterEmail"
                  label="Email"
                  hint="Promoter's email address."
                  type="email"
                  value={local.promoter.email ?? ''}
                  onChange={(v) => updateSection('promoter', 'email', v)}
                  required
                />
              </>
            )}
            <div className="sm:col-span-2 border-t border-neutral-100 pt-4 mt-2">
              <p className="text-sm font-medium text-neutral-700 mb-3">Residential address</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="resBuilding"
                  label="Building"
                  hint="Door / flat and building name."
                  value={local.promoterAddress.building ?? ''}
                  onChange={(v) => updatePromoterAddress('building', v)}
                  required
                />
                <FormField
                  id="resStreet"
                  label="Street"
                  hint="Street or locality."
                  value={local.promoterAddress.street ?? ''}
                  onChange={(v) => updatePromoterAddress('street', v)}
                  required
                />
                <FormField
                  id="resCity"
                  label="City"
                  hint="City or town."
                  value={local.promoterAddress.city ?? ''}
                  onChange={(v) => updatePromoterAddress('city', v)}
                  required
                />
                <FormField
                  id="resPincode"
                  label="Pincode"
                  hint="6-digit pincode."
                  value={local.promoterAddress.pincode ?? ''}
                  onChange={(v) =>
                    updatePromoterAddress('pincode', v.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                />
              </div>
            </div>

            {multiPerson && (
              <>
                <div className="sm:col-span-2 border-t border-neutral-100 pt-4 mt-2">
                  <p className="text-sm font-medium text-neutral-700 mb-3">
                    {constitution === 'huf' ? 'Additional member' : 'Partner 2'}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="partnerFirstName"
                      label="First name"
                      hint="Partner's first name."
                      value={local.partner.firstName ?? ''}
                      onChange={(v) => updateSection('partner', 'firstName', v)}
                    />
                    <FormField
                      id="partnerLastName"
                      label="Last name"
                      hint="Partner's surname."
                      value={local.partner.lastName ?? ''}
                      onChange={(v) => updateSection('partner', 'lastName', v)}
                    />
                    <FormField
                      id="partnerPan"
                      label="PAN"
                      hint="Partner's PAN."
                      type="uppercase"
                      value={local.partner.pan ?? ''}
                      onChange={(v) => updateSection('partner', 'pan', v)}
                    />
                    <FormField
                      id="partnerMobile"
                      label="Mobile"
                      hint="Partner's mobile number."
                      type="tel"
                      value={local.partner.mobile ?? ''}
                      onChange={(v) =>
                        updateSection('partner', 'mobile', v.replace(/\D/g, '').slice(0, 10))
                      }
                    />
                  </div>
                </div>
                <div className="sm:col-span-2 border-t border-neutral-100 pt-4 mt-2">
                  <p className="text-sm font-medium text-neutral-700 mb-3">
                    Authorized signatory (if different)
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="signatoryFirstName"
                      label="First name"
                      hint="Signatory's first name."
                      value={local.signatory.firstName ?? ''}
                      onChange={(v) => updateSection('signatory', 'firstName', v)}
                    />
                    <FormField
                      id="signatoryLastName"
                      label="Last name"
                      hint="Signatory's surname."
                      value={local.signatory.lastName ?? ''}
                      onChange={(v) => updateSection('signatory', 'lastName', v)}
                    />
                    <FormField
                      id="signatoryPan"
                      label="PAN"
                      hint="Signatory's PAN."
                      type="uppercase"
                      value={local.signatory.pan ?? ''}
                      onChange={(v) => updateSection('signatory', 'pan', v)}
                    />
                    <FormField
                      id="signatoryDesignation"
                      label="Designation"
                      hint="e.g. Authorized Signatory."
                      value={local.signatory.designation ?? ''}
                      onChange={(v) => updateSection('signatory', 'designation', v)}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="sm:col-span-2 border-t border-neutral-100 pt-4 mt-2">
              <p className="text-sm font-medium text-neutral-700 mb-3">Documents</p>
              <DocumentUpload
                applicationId={applicationId}
                constitution={constitution}
                documents={documents}
                onUploaded={() => onDocumentsChange?.()}
                onError={onError}
                readOnly={readOnly}
              />
            </div>
          </div>
        )}

        {step.id === ApplicationStep.PLACE_OF_BUSINESS && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SyncedFieldsBanner
              fields={[
                { label: 'District', value: syncedLocal.partA.district },
                { label: 'Email', value: syncedLocal.partA.pasEmail },
                { label: 'Mobile', value: syncedLocal.partA.pasMobile },
              ]}
            />
            {!multiPerson && (
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={placeSameAsResidential}
                  onChange={(e) => togglePlaceSameAsResidential(e.target.checked)}
                  className="rounded border-neutral-300 text-teal-700 focus:ring-teal-600"
                />
                Principal place of business is the same as residential address (Step 3)
              </label>
            )}
            <FormField
              id="building"
              label="Building / flat"
              hint="Principal business address."
              value={(syncedLocal.place.building as string) ?? ''}
              onChange={(v) => updateSection('place', 'building', v)}
              required
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="street"
              label="Street"
              hint="Street or road name."
              value={(syncedLocal.place.street as string) ?? ''}
              onChange={(v) => updateSection('place', 'street', v)}
              required
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="city"
              label="City"
              hint="City or locality."
              value={(syncedLocal.place.city as string) ?? ''}
              onChange={(v) => updateSection('place', 'city', v)}
              required
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="pincode"
              label="Pincode"
              hint="6-digit postal code."
              value={(syncedLocal.place.pincode as string) ?? ''}
              onChange={(v) =>
                updateSection('place', 'pincode', v.replace(/\D/g, '').slice(0, 6))
              }
              required
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="locality"
              label="Locality / sub-locality"
              hint="As on GST portal (e.g. Dwarka Mor)."
              value={(syncedLocal.place.locality as string) ?? ''}
              onChange={(v) => updateSection('place', 'locality', v)}
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="flatNo"
              label="Flat / building no."
              value={(syncedLocal.place.flatNo as string) ?? ''}
              onChange={(v) => updateSection('place', 'flatNo', v)}
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="floorNo"
              label="Floor no."
              value={(syncedLocal.place.floorNo as string) ?? ''}
              onChange={(v) => updateSection('place', 'floorNo', v)}
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="landmark"
              label="Nearby landmark"
              value={(syncedLocal.place.landmark as string) ?? ''}
              onChange={(v) => updateSection('place', 'landmark', v)}
              disabled={placeSameAsResidential && !multiPerson}
            />
            <FormField
              id="natureOfPossession"
              label="Nature of possession"
              hint="Ownership status of premises."
              type="select"
              value={(local.place.natureOfPossession as string) ?? ''}
              options={NATURE_OF_POSSESSION_OPTIONS}
              onChange={(v) => updateSection('place', 'natureOfPossession', v)}
              required
            />
            <FormField
              id="businessActivities"
              label="Business activities"
              hint="Comma-separated activities (e.g. Office / Sale Office)."
              value={
                Array.isArray(local.place.businessActivities)
                  ? (local.place.businessActivities as string[]).join(', ')
                  : 'Office / Sale Office'
              }
              onChange={(v) =>
                updateSection(
                  'place',
                  'businessActivities',
                  v.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
              required
            />
          </div>
        )}

        {step.id === ApplicationStep.GOODS_SERVICES && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="hsnCodes"
              label="HSN codes"
              hint="Goods codes, comma-separated (at least one HSN or SAC required)."
              value={(local.goods.hsnCodes ?? []).join(', ')}
              onChange={(v) =>
                updateSection(
                  'goods',
                  'hsnCodes',
                  v.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
            />
            <FormField
              id="sacCodes"
              label="SAC codes"
              hint="Service codes if applicable, comma-separated."
              value={(local.goods.sacCodes ?? []).join(', ')}
              onChange={(v) =>
                updateSection(
                  'goods',
                  'sacCodes',
                  v.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
            />
          </div>
        )}

        {step.id === ApplicationStep.REVIEW_SUBMIT && (
          <div className="space-y-4">
            <DocumentChecklist
              documents={formData.documents as Record<string, string> | undefined}
              constitution={constitution}
            />
            <ReviewSummary formData={fullPayload} />
            <FormField
              id="verificationPlace"
              label="Verification place"
              hint="Auto-filled from city — edit if needed."
              value={syncedLocal.verification.place ?? ''}
              onChange={(v) => updateSection('verification', 'place', v)}
              required
            />
          </div>
        )}
      </fieldset>

      {!readOnly && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => void goBack()}
            disabled={stepIndex === 0 || saving}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40 px-4 py-2.5"
          >
            {saving ? 'Saving…' : 'Back'}
          </button>
          {step.id === ApplicationStep.REVIEW_SUBMIT ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={saving || starting}
              className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-6 py-2.5 rounded-lg font-medium disabled:opacity-50"
            >
              {starting ? 'Starting automation…' : 'Start GST automation'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={saving}
              className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-6 py-2.5 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
