export const CANCELLABLE_STATUSES = [
  'QUEUED',
  'RUNNING',
  'AWAITING_CAPTCHA',
  'AWAITING_OTP',
  'AWAITING_EVC_OTP',
  'AWAITING_AADHAAR',
  'PART_B_IN_PROGRESS',
  'PART_B_SAVED',
  'SUBMITTED',
] as const;

export function canCancelAutomation(status: string): boolean {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export function canDeleteApplication(_status: string): boolean {
  return true;
}

export function restoreStatusAfterCancel(hasArn: boolean, hasTrn: boolean): string {
  if (hasArn) return 'ARN_RECEIVED';
  if (hasTrn) return 'TRN_RECEIVED';
  return 'DRAFT';
}
