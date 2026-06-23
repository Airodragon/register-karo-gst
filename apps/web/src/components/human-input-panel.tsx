'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { notifyInputRequired, requestNotificationPermission } from '@/lib/notifications';

export interface HumanInputPanelProps {
  applicationId: string;
  inputType?: string;
  inputData?: Record<string, unknown>;
  contactHints?: { mobile?: string; email?: string };
  onSubmitted: () => void;
  onError?: (message: string) => void;
  compact?: boolean;
}

function isCaptchaType(type?: string): boolean {
  return !!type?.includes('CAPTCHA');
}

function useCountdown(expiresAt?: string) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return secondsLeft;
}

export function HumanInputPanel({
  applicationId,
  inputType,
  inputData,
  contactHints,
  onSubmitted,
  onError,
  compact,
}: HumanInputPanelProps) {
  const [captcha, setCaptcha] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  const isCaptcha = isCaptchaType(inputType);
  const isPartAOtp = inputType === 'PART_A_OTP';
  const isSingleOtp =
    inputType === 'TRN_LOGIN_OTP' || inputType === 'EVC_OTP' || inputType === 'AADHAAR_OTP';
  const captchaImage = inputData?.captchaImageBase64 as string | undefined;
  const expiresAt = inputData?.expiresAt as string | undefined;
  const secondsLeft = useCountdown(expiresAt);
  const message =
    (inputData?.message as string) ??
    (isCaptcha
      ? 'Type the characters shown in the image below (from the GST portal).'
      : 'Enter the required portal input to continue automation.');

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (inputType) {
      notifyInputRequired(
        'RegisterKaro — input required',
        isCaptcha ? 'Captcha needed for GST portal' : 'OTP needed for GST portal',
      );
    }
  }, [inputType, isCaptcha]);

  useEffect(() => {
    setCaptcha('');
    setMobileOtp('');
    setEmailOtp('');
    setOtp('');
    setError('');
    setSubmitted(false);
    if (isCaptcha) {
      inputRef.current?.focus();
    } else {
      otpRef.current?.focus();
    }
  }, [inputType, captchaImage, isCaptcha]);

  async function pasteOtp(target: 'mobile' | 'email' | 'single') {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, '').slice(0, 8);
      if (target === 'mobile') setMobileOtp(digits);
      else if (target === 'email') setEmailOtp(digits);
      else setOtp(digits);
    } catch {
      onError?.('Could not read clipboard');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.submitInput(applicationId, {
        captcha: captcha.trim() || undefined,
        mobileOtp: mobileOtp.trim() || undefined,
        emailOtp: emailOtp.trim() || undefined,
        otp: otp.trim() || undefined,
        aadhaarOtp: otp.trim() || undefined,
      });
      setSubmitted(true);
      onSubmitted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  const wrapperClass = compact
    ? ''
    : 'rounded-xl border-2 border-amber-300 bg-amber-50/80 shadow-sm overflow-hidden';

  if (submitted) {
    return (
      <div className={wrapperClass}>
        <div className={compact ? 'p-4' : 'p-5'}>
          <p className="text-sm font-medium text-teal-900">Input received</p>
          <p className="text-xs text-teal-800 mt-1">
            Automation is continuing on the GST portal. This may take a minute.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {!compact && (
        <div className="bg-amber-100/80 px-5 py-3 border-b border-amber-200">
          <p className="text-sm font-semibold text-amber-900">
            {isCaptcha ? 'Captcha required' : 'Portal input required'}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">{message}</p>
          {secondsLeft !== null && (
            <p className="text-xs text-amber-900 mt-1 font-mono tabular-nums">
              Expires in {Math.floor(secondsLeft / 60)}:
              {(secondsLeft % 60).toString().padStart(2, '0')}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className={compact ? 'p-4 space-y-3' : 'p-5 space-y-4'}>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!isCaptcha && (contactHints?.mobile || contactHints?.email) && (
          <div className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
            OTP sent to{' '}
            {contactHints.mobile && (
              <span>
                mobile <strong>{contactHints.mobile}</strong>
              </span>
            )}
            {contactHints.mobile && contactHints.email && ' and '}
            {contactHints.email && (
              <span>
                email <strong>{contactHints.email}</strong>
              </span>
            )}
          </div>
        )}

        {isCaptcha && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-800">
              Type the characters you see in the image below
              <span className="text-red-500 ml-0.5">*</span>
            </label>

            {captchaImage ? (
              <div className="inline-block rounded-lg border border-neutral-300 bg-white p-2 shadow-inner">
                <img
                  src={`data:image/png;base64,${captchaImage}`}
                  alt="GST portal captcha"
                  className="block max-h-24 min-h-[48px] w-auto mx-auto"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-amber-300 bg-white px-4 py-8 text-center text-sm text-amber-800">
                Captcha image loading…
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              placeholder="Enter captcha characters"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              required
              disabled={!captchaImage}
            />
          </div>
        )}

        {isPartAOtp && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">
                  Mobile OTP<span className="text-red-500 ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => pasteOtp('mobile')}
                  className="text-xs text-teal-700 hover:underline"
                >
                  Paste
                </button>
              </div>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                value={mobileOtp}
                onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">
                  Email OTP<span className="text-red-500 ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => pasteOtp('email')}
                  className="text-xs text-teal-700 hover:underline"
                >
                  Paste
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
                required
              />
            </div>
          </>
        )}

        {isSingleOtp && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">
                OTP<span className="text-red-500 ml-0.5">*</span>
              </label>
              <button
                type="button"
                onClick={() => pasteOtp('single')}
                className="text-xs text-teal-700 hover:underline"
              >
                Paste
              </button>
            </div>
            <input
              ref={otpRef}
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (isCaptcha && !captchaImage)}
          className="w-full bg-teal-700 hover:bg-teal-600 text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Submitting…' : isCaptcha ? 'Submit captcha & continue' : 'Submit & continue'}
        </button>
      </form>
    </div>
  );
}
