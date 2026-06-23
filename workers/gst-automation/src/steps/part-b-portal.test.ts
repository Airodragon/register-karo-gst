import { describe, expect, it } from 'vitest';
import { splitFullName, reasonRegistrationCandidates } from './part-b-portal';

describe('part-b-portal helpers', () => {
  it('splits father name into parts', () => {
    expect(splitFullName('BASANT MURARI')).toEqual({
      first: 'BASANT',
      middle: '',
      last: 'MURARI',
    });
  });

  it('maps reason for registration aliases', () => {
    expect(reasonRegistrationCandidates('Crossing the threshold')).toContain('Voluntary Basis');
  });
});
