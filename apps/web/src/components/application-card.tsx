'use client';

import Link from 'next/link';
import { STATUS_LABELS } from '@registerkaro/shared-types';
import clsx from 'clsx';
import type { ApplicationSummary } from '@/lib/api';
import { formatRelativeTime } from '@/lib/application-actions';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-700',
  QUEUED: 'bg-slate-100 text-slate-700',
  RUNNING: 'bg-blue-50 text-blue-700',
  AWAITING_CAPTCHA: 'bg-amber-50 text-amber-800',
  AWAITING_OTP: 'bg-amber-50 text-amber-800',
  AWAITING_EVC_OTP: 'bg-amber-50 text-amber-800',
  AWAITING_AADHAAR: 'bg-purple-50 text-purple-700',
  PART_B_IN_PROGRESS: 'bg-blue-50 text-blue-700',
  TRN_RECEIVED: 'bg-teal-50 text-teal-700',
  ARN_RECEIVED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  BIOMETRIC_REQUIRED: 'bg-orange-50 text-orange-800',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLORS[status] ?? 'bg-neutral-100 text-neutral-600',
      )}
    >
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
    </span>
  );
}

export function ApplicationCard({
  app,
  onDelete,
}: {
  app: ApplicationSummary;
  onDelete?: () => void;
}) {
  return (
    <div className="relative bg-white border border-neutral-200 rounded-xl p-5 hover:border-teal-600/30 hover:shadow-sm transition group">
      <Link href={`/applications/${app.id}`} className="block">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div>
            <p className="font-medium text-neutral-900">{app.clientRef}</p>
            <p className="text-xs text-neutral-500 mt-0.5 capitalize">{app.constitution}</p>
          </div>
          <StatusBadge status={app.status} />
        </div>
        <div className="mt-4 space-y-1 text-sm text-neutral-600">
          {app.trn && (
            <p>
              TRN: <span className="font-mono text-neutral-800">{app.trn}</span>
            </p>
          )}
          {app.arn && (
            <p>
              ARN: <span className="font-mono text-neutral-800">{app.arn}</span>
            </p>
          )}
          {app.daysUntilTrnExpiry !== undefined && app.trn && !app.arn && (
            <p className={clsx(app.daysUntilTrnExpiry <= 3 && 'text-amber-700 font-medium')}>
              TRN expires in {app.daysUntilTrnExpiry} day{app.daysUntilTrnExpiry !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {app.needsAttention && !app.actionRequired && (
            <span className="text-xs font-medium text-orange-800 bg-orange-50 rounded-lg px-2 py-1">
              Needs attention
            </span>
          )}
          {app.actionRequired ? (
            <span className="text-xs font-medium text-amber-800 bg-amber-50 rounded-lg px-2 py-1">
              Input needed
            </span>
          ) : (
            <span className="text-xs text-neutral-400">{formatRelativeTime(app.updatedAt)}</span>
          )}
          {app.automationProgress && app.status !== 'ARN_RECEIVED' && app.status !== 'DRAFT' && (
            <span className="text-xs font-medium text-teal-700 tabular-nums">
              {app.automationProgress.percent}%
            </span>
          )}
        </div>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition"
          aria-label="Delete filing"
          title="Delete filing"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
