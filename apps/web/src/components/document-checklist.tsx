'use client';

import { DOCUMENT_FIELDS, validateDocuments, type DocumentType } from '@/lib/documents';
import clsx from 'clsx';

interface DocumentChecklistProps {
  documents?: Record<string, string>;
  constitution?: string;
}

export function DocumentChecklist({ documents, constitution }: DocumentChecklistProps) {
  const { valid, missing } = validateDocuments(documents, constitution);

  const fields = DOCUMENT_FIELDS.filter((f) => {
    if (f.type === 'signatoryAppointmentProof') {
      return constitution === 'partnership' || constitution === 'huf';
    }
    return f.required;
  });

  const labelByType = Object.fromEntries(DOCUMENT_FIELDS.map((f) => [f.type, f.label]));

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        valid ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50',
      )}
    >
      <p className="text-sm font-medium text-neutral-900 mb-3">
        Document checklist
        {valid ? (
          <span className="ml-2 text-xs font-normal text-green-700">All required documents uploaded</span>
        ) : (
          <span className="ml-2 text-xs font-normal text-amber-800">
            {missing.length} document{missing.length !== 1 ? 's' : ''} missing
          </span>
        )}
      </p>
      <ul className="space-y-1.5">
        {fields.map((field) => {
          const uploaded = !!documents?.[field.type];
          return (
            <li key={field.type} className="flex items-center gap-2 text-sm">
              <span
                className={clsx(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  uploaded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
                )}
              >
                {uploaded ? '✓' : '✗'}
              </span>
              <span className={uploaded ? 'text-neutral-700' : 'text-neutral-900'}>
                {field.label}
              </span>
            </li>
          );
        })}
      </ul>
      {!valid && (
        <p className="text-xs text-amber-800 mt-3">
          Missing: {missing.map((t) => labelByType[t as DocumentType]).join(', ')}
        </p>
      )}
    </div>
  );
}
