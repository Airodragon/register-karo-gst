import { ApplicationStep } from '@registerkaro/shared-types';
import {
  businessSchema,
  goodsAndServicesSchema,
  partASchema,
  personSchema,
  principalPlaceSchema,
  verificationSchema,
} from '@registerkaro/gst-form-schema';
import type { ZodSchema } from 'zod';

export const WIZARD_STEPS = [
  {
    id: ApplicationStep.CLIENT_PART_A,
    title: 'Client details',
    subtitle: 'Basic info for GST Part A',
    schema: partASchema,
  },
  {
    id: ApplicationStep.BUSINESS,
    title: 'Business',
    subtitle: 'Trade name and registration reason',
    schema: businessSchema,
  },
  {
    id: ApplicationStep.PEOPLE,
    title: 'Promoter / PAS',
    subtitle: 'Authorized signatory details',
    schema: personSchema,
  },
  {
    id: ApplicationStep.PLACE_OF_BUSINESS,
    title: 'Business address',
    subtitle: 'Principal place of business',
    schema: principalPlaceSchema,
  },
  {
    id: ApplicationStep.GOODS_SERVICES,
    title: 'Goods & services',
    subtitle: 'HSN / SAC codes',
    schema: goodsAndServicesSchema,
  },
  {
    id: ApplicationStep.REVIEW_SUBMIT,
    title: 'Review',
    subtitle: 'Confirm and start automation',
    schema: verificationSchema,
  },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

export function wizardStepIndex(step: string): number {
  const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
  return idx >= 0 ? idx : 0;
}

export function validateWizardStep(
  stepId: WizardStepId,
  payload: unknown,
): { success: true } | { success: false; errors: string[] } {
  const step = WIZARD_STEPS.find((s) => s.id === stepId);
  if (!step) return { success: false, errors: ['Unknown step'] };
  const result = (step.schema as ZodSchema).safeParse(payload);
  if (result.success) return { success: true };
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
  };
}

export function isAutomationActive(status: string): boolean {
  return [
    'QUEUED',
    'RUNNING',
    'AWAITING_CAPTCHA',
    'AWAITING_OTP',
    'AWAITING_EVC_OTP',
    'AWAITING_AADHAAR',
    'PART_B_IN_PROGRESS',
    'PART_B_SAVED',
    'SUBMITTED',
  ].includes(status);
}

export function constitutionToBusinessLabel(constitution?: string): string {
  switch (constitution) {
    case 'partnership':
      return 'Partnership';
    case 'huf':
      return 'Hindu Undivided Family';
    default:
      return 'Proprietorship';
  }
}

export function isMultiPersonEntity(constitution?: string): boolean {
  return constitution === 'partnership' || constitution === 'huf';
}

export function isFormEditable(status: string): boolean {
  return status === 'DRAFT' || status === 'FAILED';
}

export function canEditDocuments(status: string): boolean {
  return status === 'DRAFT' || status === 'FAILED' || status === 'TRN_RECEIVED';
}
