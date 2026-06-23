'use client';

import { useState } from 'react';
import clsx from 'clsx';

const CONSTITUTIONS = [
  {
    value: 'proprietorship',
    label: 'Proprietorship',
    description: 'Single owner business',
  },
  {
    value: 'partnership',
    label: 'Partnership',
    description: 'Two or more partners',
  },
  {
    value: 'huf',
    label: 'HUF',
    description: 'Hindu Undivided Family',
  },
] as const;

export type ConstitutionValue = (typeof CONSTITUTIONS)[number]['value'];

interface CreateFilingModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { clientRef: string; constitution: ConstitutionValue }) => Promise<void>;
}

export function CreateFilingModal({ open, onClose, onCreate }: CreateFilingModalProps) {
  const [clientRef, setClientRef] = useState(() => `CLIENT-${Date.now()}`);
  const [constitution, setConstitution] = useState<ConstitutionValue>('proprietorship');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientRef.trim()) {
      setError('Client reference is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreate({ clientRef: clientRef.trim(), constitution });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create filing');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900">New GST filing</h2>
        <p className="text-sm text-neutral-500 mt-1">Choose entity type and client reference.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Client reference<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={clientRef}
              onChange={(e) => setClientRef(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">
              Constitution<span className="text-red-500 ml-0.5">*</span>
            </p>
            <div className="space-y-2">
              {CONSTITUTIONS.map((c) => (
                <label
                  key={c.value}
                  className={clsx(
                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition',
                    constitution === c.value
                      ? 'border-teal-600 bg-teal-50/50'
                      : 'border-neutral-200 hover:border-neutral-300',
                  )}
                >
                  <input
                    type="radio"
                    name="constitution"
                    value={c.value}
                    checked={constitution === c.value}
                    onChange={() => setConstitution(c.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{c.label}</p>
                    <p className="text-xs text-neutral-500">{c.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-neutral-600 px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-5 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create filing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
