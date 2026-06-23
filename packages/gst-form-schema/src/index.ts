import { z } from 'zod';

export const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format');

export const mobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number');

export const pincodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Pincode must be 6 digits');

export const addressSchema = z.object({
  building: z.string().min(1, 'Building is required'),
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: pincodeSchema,
});

export const partASchema = z.object({
  taxpayerType: z.literal('Taxpayer'),
  state: z.string().min(1),
  district: z.string().min(1),
  legalName: z.string().min(2).max(200),
  pan: panSchema,
  pasEmail: z.string().email(),
  pasMobile: mobileSchema,
});

export const businessSchema = z.object({
  tradeName: z.string().min(1),
  constitutionOfBusiness: z.enum([
    'Proprietorship',
    'Partnership',
    'Hindu Undivided Family',
  ]),
  district: z.string().min(1),
  compositionLevy: z.boolean().default(false),
  rule14A: z.boolean().default(false),
  commencementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  liabilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  casualTaxpayer: z.boolean().default(false),
  reasonForRegistration: z.string().min(1),
});

export const personSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  fatherName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mobile: mobileSchema,
  email: z.string().email(),
  gender: z.enum(['Male', 'Female', 'Other']),
  designation: z.string().min(1),
  pan: panSchema,
  isPrimaryAuthorizedSignatory: z.boolean(),
  residentialAddress: addressSchema,
});

export const principalPlaceSchema = z.object({
  building: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  pincode: pincodeSchema,
  district: z.string().min(1),
  email: z.string().email(),
  mobile: mobileSchema,
  telephone: z.string().optional(),
  natureOfPossession: z.enum(['Own', 'Rented', 'Leased', 'Consent', 'Others']),
  businessActivities: z.array(z.string()).min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const goodsAndServicesSchema = z.object({
  hsnCodes: z.array(z.string()).max(5).default([]),
  sacCodes: z.array(z.string()).max(5).default([]),
}).refine(
  (data) => data.hsnCodes.length > 0 || data.sacCodes.length > 0,
  { message: 'At least one HSN or SAC code is required' },
);

export const stateSpecificSchema = z.object({
  electricityBoard: z.string().optional(),
  caNumber: z.string().optional(),
  professionalTaxEcNo: z.string().optional(),
  professionalTaxRcNo: z.string().optional(),
  stateExciseLicenseNo: z.string().optional(),
});

export const aadhaarAuthSchema = z.object({
  optIn: z.boolean().default(true),
  selectedPersons: z.array(z.string()).min(1),
});

export const verificationSchema = z.object({
  place: z.string().min(1),
  submissionMethod: z.enum(['EVC', 'E_SIGNATURE']).default('EVC'),
});

export const documentRefsSchema = z.object({
  promoterPhoto: z.string().optional(),
  addressProof: z.string().optional(),
  signatoryAppointmentProof: z.string().optional(),
  panCard: z.string().optional(),
});

export function getRequiredDocumentTypes(
  constitution?: 'proprietorship' | 'partnership' | 'huf',
): Array<keyof z.infer<typeof documentRefsSchema>> {
  const base = ['promoterPhoto', 'panCard', 'addressProof'] as const;
  if (constitution === 'partnership' || constitution === 'huf') {
    return [...base, 'signatoryAppointmentProof'];
  }
  return [...base];
}

export function validateRequiredDocuments(
  documents: Record<string, string> | undefined,
  constitution?: 'proprietorship' | 'partnership' | 'huf',
): { valid: boolean; missing: string[] } {
  const required = getRequiredDocumentTypes(constitution);
  const missing = required.filter((type) => !documents?.[type]);
  return { valid: missing.length === 0, missing };
}

export const applicationFormSchema = z.object({
  partA: partASchema,
  business: businessSchema,
  promoter: personSchema,
  partners: z.array(personSchema).optional(),
  authorizedSignatory: personSchema.optional(),
  principalPlaceOfBusiness: principalPlaceSchema,
  goodsAndServices: goodsAndServicesSchema,
  stateSpecific: stateSpecificSchema.optional(),
  aadhaarAuthentication: aadhaarAuthSchema,
  verification: verificationSchema,
  documents: documentRefsSchema.optional(),
});

export const createApplicationSchema = z.object({
  clientRef: z.string().min(1),
  constitution: z.enum(['proprietorship', 'partnership', 'huf']),
  formData: applicationFormSchema.deepPartial().optional(),
});

export const userInputSchema = z.object({
  captcha: z.string().optional(),
  mobileOtp: z.string().optional(),
  emailOtp: z.string().optional(),
  otp: z.string().optional(),
  aadhaarOtp: z.string().optional(),
});

export type PartAInput = z.infer<typeof partASchema>;
export type BusinessInput = z.infer<typeof businessSchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UserInputPayload = z.infer<typeof userInputSchema>;

export const wizardStepSchemas = {
  partA: partASchema,
  business: businessSchema,
  people: z.object({
    promoter: personSchema,
    partners: z.array(personSchema).optional(),
    authorizedSignatory: personSchema.optional(),
  }),
  placeOfBusiness: principalPlaceSchema,
  goodsAndServices: goodsAndServicesSchema,
  reviewSubmit: z.object({
    aadhaarAuthentication: aadhaarAuthSchema,
    verification: verificationSchema,
  }),
};
