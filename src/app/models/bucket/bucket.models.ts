import {
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

  documents: LoanDocumentResponse[] | null;
  review: LoanReviewResponse | null;
  bmdecision: LoanDecisionResponse | null;
  verifications: LoanVerificationResponse[] | null;
  disbursement: LoanDisbursementResponse | null;

  creditScore?: number;
}
