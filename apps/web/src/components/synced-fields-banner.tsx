'use client';

interface SyncedFieldsBannerProps {
  title?: string;
  fields: Array<{ label: string; value?: string }>;
}

/** Read-only summary of fields auto-filled from an earlier wizard step. */
export function SyncedFieldsBanner({
  title = 'Auto-filled from client details (Step 1)',
  fields,
}: SyncedFieldsBannerProps) {
  const visible = fields.filter((f) => f.value?.trim());
  if (!visible.length) return null;

  return (
    <div className="sm:col-span-2 rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3">
      <p className="text-sm font-medium text-teal-900 mb-2">{title}</p>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-teal-800/70">{f.label}</dt>
            <dd className="text-sm font-medium text-teal-950">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-teal-800/60 mt-2">
        Update these on Step 1 if they need to change.
      </p>
    </div>
  );
}
