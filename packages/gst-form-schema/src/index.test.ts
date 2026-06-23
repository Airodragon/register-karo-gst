import { describe, expect, it } from 'vitest';
import {
  validateRequiredDocuments,
  panSchema,
  mobileSchema,
} from './index';

const CANCELLABLE = new Set([
  'QUEUED',
  'RUNNING',
  'AWAITING_CAPTCHA',
  'AWAITING_OTP',
  'AWAITING_EVC_OTP',
  'AWAITING_AADHAAR',
  'PART_B_IN_PROGRESS',
  'PART_B_SAVED',
  'SUBMITTED',
]);

function canCancelAutomation(status: string) {
  return CANCELLABLE.has(status);
}

describe('validateRequiredDocuments', () => {
  it('requires promoter photo, pan, and address for proprietorship', () => {
    const result = validateRequiredDocuments({}, 'proprietorship');
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('promoterPhoto');
    expect(result.missing).toContain('panCard');
    expect(result.missing).toContain('addressProof');
  });

  it('passes when all proprietorship docs present', () => {
    const result = validateRequiredDocuments(
      {
        promoterPhoto: 'key1',
        panCard: 'key2',
        addressProof: 'key3',
      },
      'proprietorship',
    );
    expect(result.valid).toBe(true);
  });

  it('requires signatory proof for partnership', () => {
    const result = validateRequiredDocuments(
      {
        promoterPhoto: 'a',
        panCard: 'b',
        addressProof: 'c',
      },
      'partnership',
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('signatoryAppointmentProof');
  });
});

describe('panSchema', () => {
  it('accepts valid PAN', () => {
    expect(panSchema.safeParse('ABCDE1234F').success).toBe(true);
  });

  it('rejects invalid PAN', () => {
    expect(panSchema.safeParse('invalid').success).toBe(false);
  });
});

describe('mobileSchema', () => {
  it('accepts valid Indian mobile', () => {
    expect(mobileSchema.safeParse('9876543210').success).toBe(true);
  });
});

describe('canCancelAutomation', () => {
  it('allows cancel during active automation', () => {
    expect(canCancelAutomation('RUNNING')).toBe(true);
    expect(canCancelAutomation('AWAITING_CAPTCHA')).toBe(true);
  });

  it('disallows cancel for draft', () => {
    expect(canCancelAutomation('DRAFT')).toBe(false);
  });
});
