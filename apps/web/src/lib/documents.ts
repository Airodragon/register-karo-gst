export type DocumentType =
  | 'promoterPhoto'
  | 'addressProof'
  | 'signatoryAppointmentProof'
  | 'panCard';

export interface DocumentFieldConfig {
  type: DocumentType;
  label: string;
  hint: string;
  required: boolean;
}

export const DOCUMENT_FIELDS: DocumentFieldConfig[] = [
  {
    type: 'promoterPhoto',
    label: 'Promoter photo',
    hint: 'Passport-size photo of the promoter (JPEG/PNG, max 2 MB).',
    required: true,
  },
  {
    type: 'panCard',
    label: 'PAN card',
    hint: 'Scanned copy of PAN card (PDF/JPEG/PNG, max 2 MB).',
    required: true,
  },
  {
    type: 'addressProof',
    label: 'Address proof',
    hint: 'Proof of principal place of business (PDF/JPEG/PNG, max 2 MB).',
    required: true,
  },
  {
    type: 'signatoryAppointmentProof',
    label: 'Signatory appointment proof',
    hint: 'Required for partnership/HUF when signatory differs from promoter.',
    required: false,
  },
];

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
];

export const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function getRequiredDocuments(constitution?: string): DocumentType[] {
  const base: DocumentType[] = ['promoterPhoto', 'panCard', 'addressProof'];
  if (constitution === 'partnership' || constitution === 'huf') {
    return [...base, 'signatoryAppointmentProof'];
  }
  return base;
}

export function validateDocuments(
  documents: Record<string, string> | undefined,
  constitution?: string,
): { valid: boolean; missing: DocumentType[] } {
  const required = getRequiredDocuments(constitution);
  const missing = required.filter((type) => !documents?.[type]);
  return { valid: missing.length === 0, missing };
}
