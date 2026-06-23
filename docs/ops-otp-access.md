# Ops Email & OTP Access — v1 Decision

## Decision: Manual OTP entry (v1)

For the initial release, all OTP and captcha inputs are entered manually by operators through the RegisterKaro dashboard. This avoids IMAP integration complexity and keeps sensitive credentials out of the automation layer.

## Recommended ops setup

1. **Filing email**: Use a dedicated inbox (e.g. `filings@yourcompany.com`) for PAS email on all Part A filings.
2. **Mobile number**: Use dedicated SIM(s) for OTP. One concurrent filing per SIM is safest.
3. **Aadhaar auth links**: After submit, operators receive links on promoter/PAS email. They complete Aadhaar OTP via the link or paste OTP into the dashboard when prompted.

## v1.1 (future)

- IMAP polling on filing inbox to auto-detect Aadhaar authentication links
- SMS gateway webhook for OTP auto-fill (requires provider integration)

## Sample data

See [`fixtures/sample-proprietorship-filing.json`](../fixtures/sample-proprietorship-filing.json) for the anonymized development filing pack structure.
