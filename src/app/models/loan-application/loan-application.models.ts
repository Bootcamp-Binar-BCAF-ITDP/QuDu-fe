export const LoanStatus = {
  CHECKING: 'CHECKING',
  REJECTED_BY_MARKETING: 'REJECTED_BY_MARKETING',
  PENDING_BRANCH_MANAGER: 'PENDING_BRANCH_MANAGER',
  REJECTED_BY_BRANCH_MANAGER: 'REJECTED_BY_BRANCH_MANAGER',
  PENDING_BACK_OFFICE: 'PENDING_BACK_OFFICE',
  VERIFIED: 'VERIFIED',
  DISBURSED: 'DISBURSED',
  REJECTED_BY_BACK_OFFICE: 'REJECTED_BY_BACK_OFFICE'
} as const;

export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const ALL_STATUSES = Object.values(LoanStatus) as LoanStatus[];

export const TERMINAL_STATUSES: readonly LoanStatus[] = [
  LoanStatus.REJECTED_BY_MARKETING,
  LoanStatus.REJECTED_BY_BRANCH_MANAGER,
  LoanStatus.REJECTED_BY_BACK_OFFICE,
  LoanStatus.DISBURSED,
];

export function isTerminal(status: LoanStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface StatusGroup {
  key: string;
  label: string;
  pattern: RegExp | null;
}

export const STATUS_GROUPS: StatusGroup[] = [
  {
    key: 'all',
    label: 'All',
    pattern: null,
  },
  {
    key: 'pending',
    label: 'Pending',
    pattern: /^(CHECKING|PENDING_)/,
  },
  {
    key: 'approved',
    label: 'Approved',
    pattern: /^(VERIFIED|DISBURSED)$/,
  },
  {
    key: 'rejected',
    label: 'Rejected',
    pattern: /^REJECTED_/,
  },
];

export function statusesMatching(pattern: RegExp | null): LoanStatus[] {
  if (!pattern) {
    return [];
  }

  return ALL_STATUSES.filter((status) => pattern.test(status));
}

export interface UserSummary {
  userId: string;
  username: string;
  fullName: string;
  roleName: string;
}

export interface CustomerSummary {
  customerId: string;
  customerName: string;
  nik?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;

  employer?: string;
  employmentLengthMonths?: number;
  verifiedMonthlyIncome?: number;
}

export interface LoanDocumentResponse {
  documentId: number;
  applicationId?: string;
  /** e.g. 'KTP', 'KK', 'SELFIE', 'SLIP_GAJI', 'BANK_ACCOUNT' */
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

export type ReviewRecommendation = 'ACCEPT' | 'REJECT';

export interface LoanReviewResponse {
  reviewId: number;
  applicationId?: string;
  marketing: UserSummary | null;
  recommendation?: ReviewRecommendation | string;
  reviewNote?: string;
  uploadedAt?: string;
}

export type DecisionOutcome = 'APPROVED' | 'REJECTED';

export interface LoanDecisionResponse {
  decisionId: number;
  applicationId?: string;
  branchManager: UserSummary | null;
  decision?: DecisionOutcome | string;
  decisionNote?: string;
  decidedAt?: string;
}

export interface LoanVerificationResponse {
  verificationId: number;
  applicationId?: string;
  verifiedBy: UserSummary | null;

  callStatus?: string;
  verificationNote?: string;
  verificationDate?: string;
}

export interface LoanDisbursementResponse {
  disbursementId: number;
  applicationId?: string;
  processedBy: UserSummary | null;
  decision?: DecisionOutcome | string;
  decisionNote?: string;
  disbursedAmount?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  disbursementDate?: string;
}

/** Matches CreditScoreResponse on the backend. */
export type CreditScoreBand = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'UNKNOWN';

/**
 * The debt service ratio, computed by the server.
 *
 * Also what the review screens label DTI: instalment over income is the same
 * arithmetic under either name. Nothing here is recomputed in the browser,
 * because the interest rate depends on the plafond tier the customer holds and
 * only the server knows which one that is.
 */
export interface CreditScore {
  monthlyInstalment: number | null;
  /** Annual rate as a fraction: 0.12 is 12 percent. Differs per plafond tier. */
  annualInterestRate: number | null;
  monthlyIncome: number | null;
  /** Percent. Null when it could not be computed, which is not zero. */
  dsr: number | null;
  band: CreditScoreBand;
  unavailableReason: string | null;
}

export interface LoanApplication {
  applicationId: string;
  customer: CustomerSummary | null;
  requestedAmount: number;
  tenor: number;
  purpose: string;
  income: number;
  status: LoanStatus;
  /** e.g. '2026-08-22' */
  submissionDate: string;
  bank: string;
  bankAccountNumber: string;
  bankAccountName: string;

  documents: LoanDocumentResponse[] | null;
  review: LoanReviewResponse | null;
  /** Branch manager decision. The API serialises this key in lower case. */
  bmdecision: LoanDecisionResponse | null;
  verifications: LoanVerificationResponse[] | null;
  disbursement: LoanDisbursementResponse | null;

  creditScore?: CreditScore | null;
}

export type SortDirection = 'asc' | 'desc';

export const SORTABLE_FIELDS = [
  'applicationId',
  'requestedAmount',
  'tenor',
  'purpose',
  'income',
  'status',
  'submissionDate',
] as const;

export type SortableField = (typeof SORTABLE_FIELDS)[number];

export interface LoanApplicationQuery {
  page: number;
  size: number;
  sortBy: SortableField;
  sortDir: SortDirection;

  statuses?: LoanStatus[];
  search?: string;

  /**
   * Inclusive bounds on submissionDate, ISO yyyy-MM-dd. Either may be omitted
   * for an open-ended window; the server widens the missing side.
   */
  from?: string;
  to?: string;
}

export interface BranchManagerDecisionRequest {
  applicationId: string;
  approve: boolean;
  note?: string;
}

export const CALL_STATUSES = [
  'Can be Contacted',
  'Nada Sambung Tidak Diangkat',
  'Salah Sambung',
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export interface LoanVerificationRequest {
  applicationId: string;
  callStatus: string;
  verificationNote?: string;
}

export interface LoanDisbursementRequest {
  applicationId: string;
  approve: boolean
  note?: string
}

export interface LoanReviewRequest {
  applicationId: string;
  recommendation: 'ACCEPT' | 'REJECT';
  reviewNote?: string;
}
