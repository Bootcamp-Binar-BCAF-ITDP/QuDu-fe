/* ---------- status ---------- */

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

/* ---------- status groups (tabs) ---------- */

export interface StatusGroup {
  key: string;
  label: string;
  /** null = no filter (All). Matched against the status name. */
  pattern: RegExp | null;
}

export const STATUS_GROUPS: StatusGroup[] = [
  {
    key: 'all',
    label: 'All',
    pattern: null,
  },
  {
    // Awaiting marketing review — this desk's inbox.
    key: 'bucket',
    label: 'Bucket',
    pattern: /^CHECKING$/,
  },
  {
    // In flight with someone else: branch manager or back office.
    key: 'pending',
    label: 'Pending',
    pattern: /^PENDING_/,
  },
  {
    // Cleared all the way through.
    key: 'approved',
    label: 'Approved',
    pattern: /^(VERIFIED|DISBURSED)$/,
  },
  {
    // Rejected at any stage.
    key: 'rejected',
    label: 'Rejected',
    pattern: /^REJECTED_/,
  },
];

/**
 * Expands a group's pattern into the statuses it covers.
 * Returns [] for the "All" group, meaning "send no status filter".
 */
export function statusesMatching(pattern: RegExp | null): LoanStatus[] {
  if (!pattern) {
    return [];
  }

  return ALL_STATUSES.filter((status) => pattern.test(status));
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
  /** e.g. 'KTP', 'SALARY_SLIP', 'BANK_STATEMENT' */
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface LoanReviewResponse {
  reviewId: number;
  marketingUserId?: string;
  marketingName?: string;
  branchName?: string;
  reviewNote?: string;
  reviewDate?: string;
  approved?: boolean;
}

export interface LoanDecisionResponse {
  decisionId: number;
  branchManagerName?: string;
  decision: 'APPROVED' | 'REJECTED';
  decisionNote?: string;
  decidedAt?: string;
}

export interface LoanVerificationResponse {
  verificationId: number;
  verifiedBy?: string;
  result?: string;
  note?: string;
  verifiedAt?: string;
}

export interface LoanDisbursementResponse {
  disbursementId: number;
  amount?: number;
  disbursedAt?: string;
  accountNumber?: string;
}

/* ---------- the application ---------- */

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
  bmdecision: LoanDecisionResponse | null;
  verifications: LoanVerificationResponse[] | null;
  disbursement: LoanDisbursementResponse | null;
}

/* ---------- requests ---------- */

export interface LoanReviewRequest {
  applicationId: string;
  approve: boolean;
  note?: string;
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
}
