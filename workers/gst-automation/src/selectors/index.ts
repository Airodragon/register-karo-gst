export const PORTAL_VERSION = '2025-06';

export const selectors = {
  navigation: {
    servicesMenu: 'text=Services',
    registrationMenu: 'text=Registration',
    newRegistration: 'text=New Registration',
    registerNow: 'a:has-text("REGISTER NOW")',
  },
  partA: {
    newRegistrationRadio: 'input[value="new"]',
    trnRadio:
      'input[type="radio"][id="radiotrn"], input[type="radio"][value="T"][name="typ"], input[type="radio"][value="trn"]',
    taxpayerDropdown: '#applnType, select[name="applnType"], select[id*="applnType"]',
    stateDropdown: '#applnState, #statecd, select[name*="State"], select[id*="state"]',
    districtDropdown: '#applnDistr, #districtcd, select[name*="Distr"], select[id*="district"]',
    legalName: '#lgnm, input[name="lgnm"], input[name*="lgnm"]',
    pan: '#pan, input[name="pan"], input[id="pan"], input[placeholder*="PAN" i]',
    email: '#email, input[name="email"], input[type="email"]',
    mobile: '#mobile, input[name="mobile"], input[type="tel"]',
    fieldLabels: {
      legalName: [/Legal Name of the Business/i],
      pan: [/Permanent Account Number/i],
      email: [/Email Address/i, /^Email$/i],
      mobile: [/Mobile Number/i, /^Mobile$/i],
      mobileOtp: [/OTP.*mobile/i, /mobile.*OTP/i, /Enter OTP.*Mobile/i],
      emailOtp: [/OTP.*email/i, /email.*OTP/i, /Enter OTP.*Email/i],
    },
    captchaInput:
      '#captchatrn, input[name*="captcha"], input[id*="captcha"], input[id*="Captcha"]',
    captchaImage: 'img[id*="captcha"], img[id*="Captcha"], img[src*="captcha"], img[src*="Captcha"], #imgCaptcha',
    proceedButton: 'button:has-text("PROCEED"), input[value="PROCEED"]',
    validateOtpButton:
      'button:has-text("VALIDATE OTP"), button:has-text("VERIFY OTP"), input[value*="VALIDATE"]',
    mobileOtp:
      'input[name*="mobileOtp" i], input[id*="motp" i], input[id*="mobileotp" i], input[placeholder*="mobile" i][placeholder*="otp" i]',
    emailOtp:
      'input[name*="emailOtp" i], input[id*="eotp" i], input[id*="emailotp" i], input[placeholder*="email" i][placeholder*="otp" i]',
    trnDisplay: 'text=/TRN|Temporary Reference Number/i',
  },
  partB: {
    trnInput:
      'input[type="text"][name*="trn" i], input#trninp, input[name="trninp"], input[name="tmpRefNo"], input[type="text"][id="trn"]',
    editIcon: 'a[title*="Edit"], .fa-pencil, img[alt*="Edit"]',
    editRowByTrn: (trn: string) =>
      `tr:has-text("${trn}") a[title*="Edit"], tr:has-text("${trn}") .fa-pencil, tr:has-text("${trn}") img[alt*="Edit"]`,
    continueButton: 'button:has-text("CONTINUE"), input[value="CONTINUE"]',
    modalYes: 'button:has-text("YES")',
    modalOk: 'button:has-text("OK")',
    saveContinue:
      'button:has-text("SAVE & CONTINUE"), button:has-text("SAVE AND CONTINUE"), button:has-text("SAVE"), input[value*="SAVE"]',
    tabs: {
      businessDetails: 'Business Details',
      promoters: 'Promoter / Partners',
      authorizedSignatory: 'Authorized Signatory',
      authorizedRepresentative: 'Authorized Representative',
      principalPlace: 'Principal Place of Business',
      additionalPlaces: 'Additional Places of Business',
      goods: 'Goods and Services',
      stateSpecific: 'State Specific Information',
      aadhaar: 'Aadhaar Authentication',
      verification: 'Verification',
    },
    jurisdiction: {
      ward: /Sector.*Circle.*Ward|Ward/i,
      commissionerate: /Commissionerate/i,
      division: /^Division$/i,
      range: /^Range$/i,
    },
    submitEvc: 'button:has-text("SUBMIT WITH EVC"), input[value*="EVC"]',
    evcOtp: 'input[name*="otp"], input[id*="otp"]',
    validateOtp: 'button:has-text("VALIDATE OTP")',
  },
  common: {
    otpSingle: 'input[name*="otp"]:not([name*="mobile"]):not([name*="email"])',
    successMessage: 'text=/success|acknowledgement|ARN/i',
    arnPattern: /ARN[:\s-]*([A-Z0-9]{15,})/i,
    trnPattern: /(\d{10,15}TRN|\d{15})/i,
  },
};
