'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

export function useToast() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  return {
    toast: message,
    showSuccess: (text: string) => setMessage({ text, type: 'success' }),
    showError: (text: string) => setMessage({ text, type: 'error' }),
    dismiss: () => setMessage(null),
  };
}

export function Toast({
  message,
  onDismiss,
}: {
  message: { text: string; type: 'success' | 'error' } | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
      <div
        className={clsx(
          'rounded-xl px-4 py-3 text-sm font-medium shadow-lg border flex items-center justify-between gap-3',
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-900'
            : 'bg-red-50 border-red-200 text-red-900',
        )}
      >
        <span>{message.text}</span>
        <button type="button" onClick={onDismiss} className="text-current opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}
