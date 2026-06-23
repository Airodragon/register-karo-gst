'use client';

import { useId, useState } from 'react';
import clsx from 'clsx';

export function FieldLabel({
  label,
  hint,
  htmlFor,
  required,
}: {
  label: string;
  hint: string;
  htmlFor?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label={`Info about ${label}`}
          aria-describedby={open ? tooltipId : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-semibold text-neutral-500 hover:border-teal-600 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        >
          i
        </button>
        {open && (
          <span
            id={tooltipId}
            role="tooltip"
            className="absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-normal leading-relaxed text-neutral-600 shadow-lg"
          >
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'uppercase';

export interface SelectOption {
  value: string;
  label: string;
}

export function FormField({
  id,
  label,
  hint,
  value,
  onChange,
  type = 'text',
  options,
  placeholder,
  disabled,
  required,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  type?: FieldType;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}) {
  const inputClass = clsx(
    'w-full border rounded-lg px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700 disabled:bg-neutral-50 disabled:text-neutral-400',
    error ? 'border-red-300 bg-red-50/30' : 'border-neutral-200',
  );

  if (type === 'select') {
    return (
      <div>
        <FieldLabel label={label} hint={hint} htmlFor={id} required={required} />
        <select
          id={id}
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder ?? `Select ${label.toLowerCase()}`}</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <FieldLabel label={label} hint={hint} htmlFor={id} required={required} />
      <input
        id={id}
        type={type === 'uppercase' ? 'text' : type}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange(type === 'uppercase' ? v.toUpperCase() : v);
        }}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
