/* status */

export const LoanStatus = {
  CHECKING: 'CHECKING',
  REJECTED_BY_MARKETING: 'REJECTED_BY_MARKETING',
  PENDING_BRANCH_MANAGER: 'PENDING_BRANCH_MANAGER',
  REJECTED_BY_BRANCH_MANAGER: 'REJECTED_BY_BRANCH_MANAGER',
  PENDING_BACK_OFFICE: 'PENDING_BACK_OFFICE',
  VERIFIED: 'VERIFIED',
  DISBURSED: 'DISBURSED',
} as const;

export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const ALL_STATUSES = Object.values(LoanStatus) as LoanStatus[];

export const TERMINAL_STATUSES: readonly LoanStatus[] = [
  LoanStatus.REJECTED_BY_MARKETING,
  LoanStatus.REJECTED_BY_BRANCH_MANAGER,
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
  /** Free text, and localised, e.g. 'Can be Contacted', 'Nada Sambung Tidak Diangkat'. */
  callStatus?: string;
  verificationNote?: string;
  verificationDate?: string;
}

export interface LoanDisbursementResponse {
  disbursementId: number;
  applicationId?: string;
  processedBy: UserSummary | null;
  disbursedAmount?: number;
  bankName?: string;
  accountNumber?: string;
  disbursementDate?: string;
}

/* application */

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

  documents: LoanDocumentResponse[] | null;
  review: LoanReviewResponse | null;
  /** Branch manager decision. The API serialises this key in lower case. */
  bmdecision: LoanDecisionResponse | null;
  verifications: LoanVerificationResponse[] | null;
  disbursement: LoanDisbursementResponse | null;
}

export interface LoanReviewRequest {
  applicationId: string;
  approve: boolean;
  note?: string;
}

/* query */

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
}
