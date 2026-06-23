'use client';

import clsx from 'clsx';
import type { AutomationProgress } from '@/lib/api';
import { isHeadlessAutomation } from '@/lib/test-mode';

export function AutomationProgressBar({
  progress,
  status,
}: {
  progress?: AutomationProgress;
  status: string;
}) {
  const percent = progress?.percent ?? (status === 'QUEUED' ? 5 : 0);
  const label = progress?.label ?? (status === 'QUEUED' ? 'Waiting to start…' : 'Preparing…');

  if (status === 'ARN_RECEIVED') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center justify-between gap-4 mb-2">
          <p className="text-sm font-medium text-green-900">Automation complete</p>
          <span className="text-sm font-semibold text-green-700">100%</span>
        </div>
        <div className="h-2 rounded-full bg-green-200 overflow-hidden">
          <div className="h-full w-full rounded-full bg-green-600 transition-all duration-500" />
        </div>
        <p className="mt-2 text-xs text-green-800">ARN received successfully</p>
      </div>
    );
  }

  if (status === 'DRAFT' || status === 'FAILED') return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Automation progress</p>
          <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
        </div>
        <span className="text-lg font-semibold tabular-nums text-teal-700">{percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-700 ease-out',
            status === 'FAILED' ? 'bg-red-500' : 'bg-teal-600',
          )}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {progress?.updatedAt && (
        <p className="mt-2 text-[11px] text-neutral-400">
          Updated {new Date(progress.updatedAt).toLocaleTimeString()}
        </p>
      )}
      {status !== 'ARN_RECEIVED' && status !== 'DRAFT' && status !== 'FAILED' && !isHeadlessAutomation() && (
        <p className="mt-2 text-[11px] text-amber-700">
          Keep the automation browser window open until finished or cancelled.
        </p>
      )}
    </div>
  );
}
