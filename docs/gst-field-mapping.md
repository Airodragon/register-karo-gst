# GST REG-01 Field Mapping — Proprietorship (v1)

Maps RegisterKaro wizard fields to GST Portal REG-01 tabs on [gst.gov.in](https://www.gst.gov.in/).

## Wizard Step 1: Client & Part A

| Our field | Portal location | Notes |
|-----------|-----------------|-------|
| `partA.taxpayerType` | Part A → I am a | Select "Taxpayer" |
| `partA.state` | Part A → State/UT | Dropdown |
| `partA.district` | Part A → District | Dropdown |
| `partA.legalName` | Part A → Legal Name | Must match PAN DB |
| `partA.pan` | Part A → PAN | Validated against CBDT |
| `partA.pasEmail` | Part A → Email | OTP sent here |
| `partA.pasMobile` | Part A → Mobile | OTP sent here |
| — | Captcha | Human input |
| — | OTP | Mobile + Email (different OTPs) |
| Output | TRN | 15-digit, valid 15 days |

## Wizard Step 2: Business Details (Tab 1)

| Our field | Portal field |
|-----------|--------------|
| `business.tradeName` | Trade Name |
| `business.constitutionOfBusiness` | Constitution of Business |
| `business.district` | District |
| `business.compositionLevy` | Option for Composition |
| `business.rule14A` | Option for registration under Rule 14A |
| `business.commencementDate` | Date of commencement of Business |
| `business.liabilityDate` | Date on which liability to register arises |
| `business.casualTaxpayer` | Casual taxable person |
| `business.reasonForRegistration` | Reason to obtain registration |

## Wizard Step 3: People (Tabs 2–3)

| Our field | Portal tab |
|-----------|------------|
| `promoter.*` | Promoter/Partners |
| `promoter.isPrimaryAuthorizedSignatory` | Designate as PAS |
| `documents.promoterPhoto` | Photo upload (max 100KB JPEG) |
| `documents.signatoryAppointmentProof` | Proof of appointment (max 1MB) |
| `authorizedSignatory.*` | Authorized Signatory (if different) |

## Wizard Step 4: Place of Business (Tab 5)

| Our field | Portal field |
|-----------|--------------|
| `principalPlaceOfBusiness.building/street/city/pincode` | Address |
| `principalPlaceOfBusiness.district` | District |
| `principalPlaceOfBusiness.email/mobile` | Contact Information |
| `principalPlaceOfBusiness.natureOfPossession` | Nature of Possession |
| `documents.addressProof` | Proof of Principal Place (max 1MB) |
| `principalPlaceOfBusiness.businessActivities` | Nature of Business activities |
| `principalPlaceOfBusiness.latitude/longitude` | Map pin (optional) |

**Skipped in v1:** Authorized Representative, Additional Places of Business, Bank Accounts.

## Wizard Step 5: Goods & Services (Tabs 7–8)

| Our field | Portal field |
|-----------|--------------|
| `goodsAndServices.hsnCodes[]` | Goods tab (max 5) |
| `goodsAndServices.sacCodes[]` | Services tab (max 5) |
| `stateSpecific.caNumber` | State Specific → CA/Electricity number |
| `stateSpecific.electricityBoard` | Name of Electricity Board |

## Wizard Step 6: Review & Submit (Tabs 9–10)

| Our field | Portal field |
|-----------|--------------|
| `aadhaarAuthentication.optIn` | Aadhaar Authentication toggle |
| `aadhaarAuthentication.selectedPersons` | Select persons for auth |
| `verification.place` | Verification → Place |
| `verification.submissionMethod` | SUBMIT WITH EVC / E-SIGNATURE |

## Post-submit: ARN

1. EVC OTP → application submitted
2. Aadhaar auth link → email/SMS to selected persons
3. Aadhaar OTP → ARN generated (OTP path) or GSK visit (biometric path)

## Constitution mapping

| RegisterKaro | Portal constitution |
|--------------|---------------------|
| `proprietorship` | Proprietorship |
| `partnership` | Partnership |
| `huf` | Hindu Undivided Family |

## Document size limits (portal)

| Document | Max size | Format |
|----------|----------|--------|
| Promoter photo | 100 KB | JPEG |
| Address proof | 1 MB | PDF/JPEG |
| Appointment proof | 1 MB | PDF/JPEG |
| E-KYC (no Aadhaar path) | 2 MB | PDF/JPEG |
