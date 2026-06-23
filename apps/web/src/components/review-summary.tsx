'use client';

import type { ReactNode } from 'react';

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-neutral-100 last:border-0">
      <dt className="text-xs text-neutral-500 sm:w-36 shrink-0">{label}</dt>
      <dd className="text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const hasContent = Array.isArray(children)
    ? children.some((c) => c !== null)
    : children !== null;
  if (!hasContent) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">{title}</h4>
      <dl>{children}</dl>
    </div>
  );
}

export function ReviewSummary({ formData }: { formData: Record<string, unknown> }) {
  const partA = (formData.partA as Record<string, string>) ?? {};
  const business = (formData.business as Record<string, string>) ?? {};
  const promoter = (formData.promoter as Record<string, unknown>) ?? {};
  const addr = (promoter.residentialAddress as Record<string, string> | undefined) ?? {};
  const place = (formData.principalPlaceOfBusiness as Record<string, string | string[]>) ?? {};
  const goods = (formData.goodsAndServices as { hsnCodes?: string[]; sacCodes?: string[] }) ?? {};
  const verification = (formData.verification as Record<string, string>) ?? {};

  const hsn = goods.hsnCodes?.filter(Boolean).join(', ');
  const sac = goods.sacCodes?.filter(Boolean).join(', ');
  const activities = Array.isArray(place.businessActivities)
    ? place.businessActivities.filter(Boolean).join(', ')
    : '';

  return (
    <div className="space-y-5 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
      <p className="text-sm text-neutral-600">
        Review the details below. Only filled fields are shown.
      </p>

      <Section title="Client">
        <Row label="Legal name" value={partA.legalName} />
        <Row label="PAN" value={partA.pan} />
        <Row label="State" value={partA.state} />
        <Row label="District" value={partA.district} />
        <Row label="PAS email" value={partA.pasEmail} />
        <Row label="PAS mobile" value={partA.pasMobile} />
      </Section>

      <Section title="Business">
        <Row label="Trade name" value={business.tradeName} />
        <Row label="Constitution" value={business.constitutionOfBusiness} />
        <Row label="Commencement" value={business.commencementDate} />
        <Row label="Liability date" value={business.liabilityDate} />
        <Row label="Reason" value={business.reasonForRegistration} />
      </Section>

      <Section title="Promoter">
        <Row
          label="Name"
          value={
            [promoter.firstName as string, promoter.lastName as string]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
        <Row label="Father's name" value={promoter.fatherName as string | undefined} />
        <Row label="DOB" value={promoter.dateOfBirth as string | undefined} />
        {promoter.pan !== partA.pan && (
          <Row label="PAN" value={promoter.pan as string | undefined} />
        )}
        {promoter.mobile !== partA.pasMobile && (
          <Row label="Mobile" value={promoter.mobile as string | undefined} />
        )}
        {promoter.email !== partA.pasEmail && (
          <Row label="Email" value={promoter.email as string | undefined} />
        )}
        <Row label="Designation" value={promoter.designation as string | undefined} />
        <Row label="Gender" value={promoter.gender as string | undefined} />
        <Row
          label="Address"
          value={
            [addr.building, addr.street, addr.city, addr.state, addr.pincode]
              .filter(Boolean)
              .join(', ') || undefined
          }
        />
      </Section>

      <Section title="Business address">
        <Row label="Building" value={place.building as string} />
        <Row label="Street" value={place.street as string} />
        <Row label="City" value={place.city as string} />
        <Row label="Pincode" value={place.pincode as string} />
        {place.district !== partA.district && (
          <Row label="District" value={place.district as string} />
        )}
        {place.email !== partA.pasEmail && (
          <Row label="Email" value={place.email as string} />
        )}
        {place.mobile !== partA.pasMobile && (
          <Row label="Mobile" value={place.mobile as string} />
        )}
        <Row label="Possession" value={place.natureOfPossession as string} />
        <Row label="Activities" value={activities} />
      </Section>

      <Section title="Goods & services">
        <Row label="HSN codes" value={hsn} />
        <Row label="SAC codes" value={sac} />
      </Section>

      <Section title="Verification">
        <Row label="Place" value={verification.place} />
      </Section>
    </div>
  );
}
