export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  AWAITING_CAPTCHA = 'AWAITING_CAPTCHA',
  AWAITING_OTP = 'AWAITING_OTP',
  TRN_RECEIVED = 'TRN_RECEIVED',
  PART_B_IN_PROGRESS = 'PART_B_IN_PROGRESS',
  PART_B_SAVED = 'PART_B_SAVED',
  SUBMITTED = 'SUBMITTED',
  AWAITING_AADHAAR = 'AWAITING_AADHAAR',
  AWAITING_EVC_OTP = 'AWAITING_EVC_OTP',
  ARN_RECEIVED = 'ARN_RECEIVED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  BIOMETRIC_REQUIRED = 'BIOMETRIC_REQUIRED',
}

export enum ApplicationStep {
  CLIENT_PART_A = 'CLIENT_PART_A',
  BUSINESS = 'BUSINESS',
  PEOPLE = 'PEOPLE',
  PLACE_OF_BUSINESS = 'PLACE_OF_BUSINESS',
  GOODS_SERVICES = 'GOODS_SERVICES',
  REVIEW_SUBMIT = 'REVIEW_SUBMIT',
  AADHAAR_TRACKING = 'AADHAAR_TRACKING',
  COMPLETE = 'COMPLETE',
}

export enum ConstitutionType {
  PROPRIETORSHIP = 'proprietorship',
  PARTNERSHIP = 'partnership',
  HUF = 'huf',
}

export enum UserInputType {
  CAPTCHA = 'CAPTCHA',
  PART_A_OTP = 'PART_A_OTP',
  TRN_LOGIN_CAPTCHA = 'TRN_LOGIN_CAPTCHA',
  TRN_LOGIN_OTP = 'TRN_LOGIN_OTP',
  EVC_OTP = 'EVC_OTP',
  AADHAAR_OTP = 'AADHAAR_OTP',
}

export enum JobEventType {
  STATUS_CHANGED = 'STATUS_CHANGED',
  INPUT_REQUIRED = 'INPUT_REQUIRED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  ERROR = 'ERROR',
  TRN_RECEIVED = 'TRN_RECEIVED',
  ARN_RECEIVED = 'ARN_RECEIVED',
}

export enum SubmissionMethod {
  EVC = 'EVC',
  E_SIGNATURE = 'E_SIGNATURE',
}

export interface Address {
  building: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export interface PartAData {
  taxpayerType: string;
  state: string;
  district: string;
  legalName: string;
  pan: string;
  pasEmail: string;
  pasMobile: string;
}

export interface BusinessData {
  tradeName: string;
  constitutionOfBusiness: string;
  district: string;
  compositionLevy: boolean;
  rule14A: boolean;
  commencementDate: string;
  liabilityDate: string;
  casualTaxpayer: boolean;
  reasonForRegistration: string;
}

export interface PersonData {
  firstName: string;
  middleName?: string;
  lastName: string;
  fatherName: string;
  dateOfBirth: string;
  mobile: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other';
  designation: string;
  pan: string;
  isPrimaryAuthorizedSignatory: boolean;
  residentialAddress: Address;
}

export interface PrincipalPlaceOfBusinessData {
  building: string;
  street: string;
  city: string;
  pincode: string;
  district: string;
  email: string;
  mobile: string;
  telephone?: string;
  natureOfPossession: 'Own' | 'Rented' | 'Leased' | 'Consent' | 'Others';
  businessActivities: string[];
  latitude?: number;
  longitude?: number;
}

export interface GoodsAndServicesData {
  hsnCodes: string[];
  sacCodes: string[];
}

export interface StateSpecificData {
  electricityBoard?: string;
  caNumber?: string;
  professionalTaxEcNo?: string;
  professionalTaxRcNo?: string;
  stateExciseLicenseNo?: string;
}

export interface AadhaarAuthData {
  optIn: boolean;
  selectedPersons: string[];
}

export interface VerificationData {
  place: string;
  submissionMethod: SubmissionMethod;
}

export interface DocumentRefs {
  promoterPhoto?: string;
  addressProof?: string;
  signatoryAppointmentProof?: string;
  panCard?: string;
}

export interface ApplicationFormData {
  partA: PartAData;
  business: BusinessData;
  promoter: PersonData;
  partners?: PersonData[];
  authorizedSignatory?: PersonData;
  principalPlaceOfBusiness: PrincipalPlaceOfBusinessData;
  goodsAndServices: GoodsAndServicesData;
  stateSpecific?: StateSpecificData;
  aadhaarAuthentication: AadhaarAuthData;
  verification: VerificationData;
  documents?: DocumentRefs;
}

export interface UserInputRequest {
  type: UserInputType;
  applicationId: string;
  jobId: string;
  captchaImageBase64?: string;
  message?: string;
  expiresAt: string;
}

export interface UserInputResponse {
  captcha?: string;
  mobileOtp?: string;
  emailOtp?: string;
  otp?: string;
  aadhaarOtp?: string;
}

export interface ApplicationSummary {
  id: string;
  clientRef: string;
  status: ApplicationStatus;
  currentStep: ApplicationStep;
  constitution: ConstitutionType;
  trn?: string;
  trnExpiresAt?: string;
  arn?: string;
  createdAt: string;
  updatedAt: string;
  actionRequired: boolean;
  pendingInput?: UserInputType;
  daysUntilTrnExpiry?: number;
  automationProgress?: {
    percent: number;
    phase: string;
    label: string;
    updatedAt: string;
  };
}

export interface AuditEvent {
  id: string;
  applicationId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  operatorId?: string;
}

export interface JobEvent {
  type: JobEventType;
  applicationId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export const APPLICATION_STEPS_ORDER: ApplicationStep[] = [
  ApplicationStep.CLIENT_PART_A,
  ApplicationStep.BUSINESS,
  ApplicationStep.PEOPLE,
  ApplicationStep.PLACE_OF_BUSINESS,
  ApplicationStep.GOODS_SERVICES,
  ApplicationStep.REVIEW_SUBMIT,
  ApplicationStep.AADHAAR_TRACKING,
  ApplicationStep.COMPLETE,
];

export * from './automation';
export * from './application-actions';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.DRAFT]: 'Draft',
  [ApplicationStatus.QUEUED]: 'Queued',
  [ApplicationStatus.RUNNING]: 'Running',
  [ApplicationStatus.AWAITING_CAPTCHA]: 'Captcha Required',
  [ApplicationStatus.AWAITING_OTP]: 'OTP Required',
  [ApplicationStatus.TRN_RECEIVED]: 'TRN Received',
  [ApplicationStatus.PART_B_IN_PROGRESS]: 'Part B In Progress',
  [ApplicationStatus.PART_B_SAVED]: 'Part B Saved',
  [ApplicationStatus.SUBMITTED]: 'Submitted',
  [ApplicationStatus.AWAITING_AADHAAR]: 'Awaiting Aadhaar',
  [ApplicationStatus.AWAITING_EVC_OTP]: 'EVC OTP Required',
  [ApplicationStatus.ARN_RECEIVED]: 'ARN Received',
  [ApplicationStatus.FAILED]: 'Failed',
  [ApplicationStatus.EXPIRED]: 'TRN Expired',
  [ApplicationStatus.BIOMETRIC_REQUIRED]: 'GSK Visit Required',
};
