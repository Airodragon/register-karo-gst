'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_FIELDS,
  MAX_FILE_SIZE,
  type DocumentType,
} from '@/lib/documents';
import clsx from 'clsx';

interface DocumentUploadProps {
  applicationId: string;
  constitution?: string;
  documents: Array<{ id: string; type: string; fileName: string }>;
  onUploaded: () => void;
  onError?: (message: string) => void;
  readOnly?: boolean;
}

export function DocumentUpload({
  applicationId,
  constitution,
  documents,
  onUploaded,
  onError,
  readOnly,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const docByType = Object.fromEntries(documents.map((d) => [d.type, d]));

  async function handleFile(type: DocumentType, file: File) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      onError?.('Only JPEG, PNG, and PDF files are allowed');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError?.('File must be 2 MB or smaller');
      return;
    }

    setUploading(type);
    try {
      await api.uploadDocument(applicationId, type, file);
      onUploaded();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleDownload(documentId: string) {
    try {
      const { url } = await api.getDocumentDownloadUrl(applicationId, documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Download failed');
    }
  }

  const fields = DOCUMENT_FIELDS.filter((f) => {
    if (f.type === 'signatoryAppointmentProof') {
      return constitution === 'partnership' || constitution === 'huf';
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Upload required documents for GST portal submission. Drag and drop or click to browse.
      </p>
      {fields.map((field) => {
        const uploaded = docByType[field.type];
        const isRequired =
          field.required ||
          (field.type === 'signatoryAppointmentProof' &&
            (constitution === 'partnership' || constitution === 'huf'));

        return (
          <div
            key={field.type}
            className={clsx(
              'rounded-lg border p-4 transition',
              uploaded ? 'border-green-200 bg-green-50/30' : 'border-neutral-200 bg-white',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">
                  {field.label}
                  {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{field.hint}</p>
              </div>
              {uploaded && (
                <span className="shrink-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                  Uploaded
                </span>
              )}
            </div>

            {uploaded ? (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-neutral-700 truncate flex-1">{uploaded.fileName}</p>
                <button
                  type="button"
                  onClick={() => handleDownload(uploaded.id)}
                  className="text-xs font-medium text-teal-700 hover:underline shrink-0"
                >
                  View
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => inputRefs.current[field.type]?.click()}
                    disabled={uploading === field.type}
                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900 shrink-0"
                  >
                    Replace
                  </button>
                )}
              </div>
            ) : (
              !readOnly && (
                <label
                  className={clsx(
                    'mt-3 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition',
                    uploading === field.type
                      ? 'border-teal-300 bg-teal-50/50'
                      : 'border-neutral-200 hover:border-teal-400 hover:bg-teal-50/30',
                  )}
                >
                  <input
                    ref={(el) => {
                      inputRefs.current[field.type] = el;
                    }}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    className="sr-only"
                    disabled={uploading === field.type}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(field.type, file);
                      e.target.value = '';
                    }}
                  />
                  <p className="text-sm text-neutral-600">
                    {uploading === field.type ? 'Uploading…' : 'Drop file or click to upload'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">JPEG, PNG, PDF · max 2 MB</p>
                </label>
              )
            )}

            {!uploaded && readOnly && (
              <p className="mt-2 text-xs text-red-600">Not uploaded</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
