'use client';

import { HumanInputPanel } from '@/components/human-input-panel';

interface InputDockProps {
  applicationId: string;
  clientRef: string;
  inputType?: string;
  inputData?: Record<string, unknown>;
  contactHints?: { mobile?: string; email?: string };
  onSubmitted: () => void;
  onError?: (message: string) => void;
  onDismiss?: () => void;
}

export function InputDock({
  applicationId,
  clientRef,
  inputType,
  inputData,
  contactHints,
  onSubmitted,
  onError,
  onDismiss,
}: InputDockProps) {
  if (!inputType) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md shadow-2xl rounded-xl border border-amber-300 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
        <p className="text-xs font-semibold text-amber-900 truncate">{clientRef}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-amber-800 hover:text-amber-950"
          >
            Minimize
          </button>
        )}
      </div>
      <HumanInputPanel
        applicationId={applicationId}
        inputType={inputType}
        inputData={inputData}
        contactHints={contactHints}
        onSubmitted={onSubmitted}
        onError={onError}
        compact
      />
    </div>
  );
}
