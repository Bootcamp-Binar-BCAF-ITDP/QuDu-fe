import {
  CreditScore,
  CustomerSummary,
  LoanDecisionResponse,
  LoanDisbursementResponse,
  LoanDocumentResponse,
  LoanReviewResponse,
  LoanStatus,
  LoanVerificationResponse,
} from '../loan-application/loan-application.models';

export interface BucketItem {
  applicationId: string;
  customer: CustomerSummary | null;
  requestedAmount: number;
  tenor: number;
  purpose: string;
  income: number;
  status: LoanStatus;
  submissionDate: string;
  bank: string
  bankAccountNumber: string

  documents: LoanDocumentResponse[] | null;
  review: LoanReviewResponse | null;
  bmdecision: LoanDecisionResponse | null;
  verifications: LoanVerificationResponse[] | null;
  disbursement: LoanDisbursementResponse | null;

  creditScore?: CreditScore | null;
}

/** Re-exported so importers of the bucket model need not reach into two files. */
export type { CreditScore, CreditScoreBand } from '../loan-application/loan-application.models';
