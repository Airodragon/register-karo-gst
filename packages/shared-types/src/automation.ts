export interface AutomationProgress {
  percent: number;
  phase: string;
  label: string;
  updatedAt: string;
  details?: Record<string, unknown>;
}

export const AUTOMATION_PHASES: Record<string, { percent: number; label: string }> = {
  queued: { percent: 5, label: 'Job queued' },
  part_a_start: { percent: 8, label: 'Opening GST portal' },
  part_a_fill: { percent: 12, label: 'Filling Part A details' },
  awaiting_captcha: { percent: 15, label: 'Waiting for captcha' },
  awaiting_part_a_otp: { percent: 20, label: 'Waiting for Part A OTP' },
  part_a_otp_submitted: { percent: 24, label: 'Submitting Part A OTP' },
  trn_received: { percent: 28, label: 'TRN received — starting Part B login' },
  trn_login: { percent: 32, label: 'Logging in with TRN' },
  awaiting_trn_captcha: { percent: 35, label: 'Waiting for TRN captcha' },
  awaiting_trn_otp: { percent: 38, label: 'Waiting for TRN OTP' },
  business_details: { percent: 45, label: 'Filling business details' },
  promoter_details: { percent: 52, label: 'Filling promoter details' },
  place_of_business: { percent: 60, label: 'Filling business address' },
  goods_services: { percent: 68, label: 'Adding HSN / SAC codes' },
  aadhaar_tab: { percent: 74, label: 'Aadhaar authentication setup' },
  authorized_rep: { percent: 55, label: 'Authorized representative' },
  additional_places: { percent: 64, label: 'Additional places of business' },
  state_specific: { percent: 70, label: 'State specific information' },
  verification_fill: { percent: 78, label: 'Filling verification' },
  awaiting_evc_otp: { percent: 82, label: 'Waiting for EVC OTP' },
  submitted: { percent: 88, label: 'Application submitted' },
  awaiting_aadhaar: { percent: 94, label: 'Waiting for Aadhaar authentication' },
  arn_received: { percent: 100, label: 'ARN received' },
  biometric_required: { percent: 90, label: 'GSK visit required' },
  failed: { percent: 0, label: 'Automation failed' },
};
