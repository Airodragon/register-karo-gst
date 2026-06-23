import districtsByState from '@/data/india-state-districts.json';

export const INDIAN_STATES = Object.keys(districtsByState).sort((a, b) =>
  a.localeCompare(b, 'en', { sensitivity: 'base' }),
);

export function getDistrictsForState(state: string): string[] {
  const districts = (districtsByState as Record<string, string[]>)[state];
  return districts ? [...districts].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) : [];
}

export const CONSTITUTION_OPTIONS = [
  { value: 'Proprietorship', label: 'Proprietorship' },
  { value: 'Partnership', label: 'Partnership' },
  { value: 'Hindu Undivided Family', label: 'Hindu Undivided Family (HUF)' },
];

export const REASON_FOR_REGISTRATION_OPTIONS = [
  { value: 'Crossing the threshold', label: 'Crossing the threshold' },
  { value: 'Voluntary Basis', label: 'Voluntary Basis' },
  { value: 'Inter-State supply', label: 'Inter-State supply' },
  { value: 'E-Commerce operator', label: 'E-Commerce operator' },
  { value: 'Casual taxable person', label: 'Casual taxable person' },
  { value: 'Others', label: 'Others' },
];

export const NATURE_OF_POSSESSION_OPTIONS = [
  { value: 'Own', label: 'Own' },
  { value: 'Rented', label: 'Rented' },
  { value: 'Leased', label: 'Leased' },
  { value: 'Consent', label: 'Consent' },
  { value: 'Others', label: 'Others' },
];
