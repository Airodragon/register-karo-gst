'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50',
              variant === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-teal-700 hover:bg-teal-600',
            )}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
